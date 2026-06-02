# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from dataclasses import dataclass
from genlayer import *


ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"


@allow_storage
@dataclass
class JobReview:
    job_id: str
    deliverable_url: str
    acceptance_criteria: str
    meets_criteria: bool
    quality_score: u256
    retry_count: u256
    issues: str
    ai_summary: str
    verdict_emitted: bool
    reviewed_at: str


def _handle_leader_error(leaders_res, leader_fn) -> bool:
    leader_msg = leaders_res.message if hasattr(leaders_res, "message") else ""
    try:
        leader_fn()
        return False
    except gl.vm.UserError as e:
        validator_msg = e.message if hasattr(e, "message") else str(e)
        if validator_msg.startswith(ERROR_EXPECTED) or validator_msg.startswith(ERROR_EXTERNAL):
            return validator_msg == leader_msg
        if validator_msg.startswith(ERROR_TRANSIENT) and leader_msg.startswith(ERROR_TRANSIENT):
            return True
        return False
    except Exception:
        return False


def _normalize_job_id(job_id) -> str:
    if isinstance(job_id, int):
        if job_id < 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Job id required")
        return "0x" + hex(job_id)[2:].rjust(64, "0")
    normalized = str(job_id)
    if normalized.startswith("0x"):
        return "0x" + normalized[2:].rjust(64, "0")
    return normalized


class WorkVerifier(gl.Contract):
    reviews: TreeMap[str, JobReview]
    owner: Address

    def __init__(self) -> None:
        self.owner = gl.message.sender_address

    @gl.public.write
    def verify_work(self, job_id: str, deliverable_url: str, acceptance_criteria: str, retry_count: int) -> None:
        normalized_job_id = _normalize_job_id(job_id)
        if len(normalized_job_id) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Job id required")
        if len(deliverable_url) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Deliverable URL required")
        if len(acceptance_criteria) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Acceptance criteria required")

        def leader_fn():
            try:
                page = gl.nondet.web.get(deliverable_url)
                if page.status >= 500:
                    raise gl.vm.UserError(f"{ERROR_TRANSIENT} Deliverable URL returned {page.status}")
                if page.status >= 400:
                    raise gl.vm.UserError(f"{ERROR_EXTERNAL} Deliverable URL not accessible: {page.status}")
                content = page.body.decode("utf-8")[:10000]
            except gl.vm.UserError:
                raise
            except Exception as e:
                raise gl.vm.UserError(f"{ERROR_TRANSIENT} Failed to fetch deliverable: {str(e)}")

            result = gl.nondet.exec_prompt(
                f"""
You are an expert technical reviewer for a decentralized freelancing platform.
Your verdict is FINAL and triggers automatic smart contract payment or refund.
Be strict but fair. Read the work carefully before deciding.

CLIENT'S ACCEPTANCE CRITERIA:
{acceptance_criteria}

SUBMITTED WORK CONTENT (from URL: {deliverable_url}):
{content}

This is attempt number {retry_count + 1}.

Evaluate whether the submitted work FULLY meets ALL acceptance criteria.
A partial pass is NOT sufficient; every criterion must be met.

Return JSON only, no other text:
{{
    "meets_criteria": true or false,
    "quality_score": integer 0-100,
    "criteria_checklist": [
        {{"criterion": "description of criterion", "met": true or false, "evidence": "what you found"}}
    ],
    "issues": ["specific issue 1 if any", "specific issue 2 if any"],
    "summary": "2-3 sentence overall assessment",
    "recommendation": "APPROVE" or "REJECT"
}}
""",
                response_format="json",
            )

            if not isinstance(result, dict):
                raise gl.vm.UserError(f"{ERROR_LLM} Non-dict response: {type(result)}")

            meets = bool(result.get("meets_criteria", False))
            recommendation = str(result.get("recommendation", "REJECT")).strip().upper()
            if meets and recommendation != "APPROVE":
                meets = False
            if (not meets) and recommendation == "APPROVE":
                meets = False

            try:
                score = int(round(float(str(result.get("quality_score", 0)).strip())))
            except Exception:
                raise gl.vm.UserError(f"{ERROR_LLM} Invalid quality_score")
            if score < 0:
                score = 0
            if score > 100:
                score = 100

            issues_list = result.get("issues", [])
            issues_str = ", ".join(str(issue) for issue in issues_list) if isinstance(issues_list, list) else str(issues_list)

            return {
                "meets_criteria": meets,
                "quality_score": score,
                "issues": issues_str,
                "summary": str(result.get("summary", "")),
            }

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader_fn)

            try:
                validator_result = leader_fn()
            except gl.vm.UserError as e:
                msg = e.message if hasattr(e, "message") else str(e)
                if msg.startswith(ERROR_TRANSIENT):
                    return True
                return False

            if leaders_res.calldata["meets_criteria"] != validator_result["meets_criteria"]:
                return False

            leader_score = int(leaders_res.calldata["quality_score"])
            validator_score = int(validator_result["quality_score"])
            if abs(leader_score - validator_score) > 15:
                return False

            return True

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        self.reviews[normalized_job_id] = JobReview(
            job_id=normalized_job_id,
            deliverable_url=deliverable_url,
            acceptance_criteria=acceptance_criteria,
            meets_criteria=result["meets_criteria"],
            quality_score=u256(result["quality_score"]),
            retry_count=u256(retry_count),
            issues=result["issues"],
            ai_summary=result["summary"],
            verdict_emitted=False,
            reviewed_at="reviewed",
        )

    @gl.public.view
    def get_verdict(self, job_id: str) -> dict:
        normalized_job_id = _normalize_job_id(job_id)
        if normalized_job_id not in self.reviews:
            return {"ready": False}
        review = self.reviews[normalized_job_id]
        return {
            "ready": True,
            "meets_criteria": review.meets_criteria,
            "quality_score": int(review.quality_score),
            "issues": review.issues,
            "summary": review.ai_summary,
            "retry_count": int(review.retry_count),
            "verdict_emitted": review.verdict_emitted,
        }

    @gl.public.write
    def mark_verdict_emitted(self, job_id: str) -> None:
        normalized_job_id = _normalize_job_id(job_id)
        if normalized_job_id not in self.reviews:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Job not found")
        review = self.reviews[normalized_job_id]
        self.reviews[normalized_job_id] = JobReview(
            job_id=review.job_id,
            deliverable_url=review.deliverable_url,
            acceptance_criteria=review.acceptance_criteria,
            meets_criteria=review.meets_criteria,
            quality_score=review.quality_score,
            retry_count=review.retry_count,
            issues=review.issues,
            ai_summary=review.ai_summary,
            verdict_emitted=True,
            reviewed_at=review.reviewed_at,
        )
