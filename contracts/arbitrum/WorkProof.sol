// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract WorkProof {
    enum JobStatus {
        Open,
        Active,
        UnderReview,
        Failed,
        AwaitingApproval,
        Passed,
        Complete,
        Refunded,
        Deleted
    }

    enum JobMode {
        Application,
        Direct,
        Competitive
    }

    enum SubmissionStatus {
        UnderReview,
        Rejected,
        Approved
    }

    struct Job {
        bytes32 jobId;
        address client;
        address assignedFreelancer;
        uint256 escrowAmount;
        uint256 rewardAmount;
        string title;
        string specIpfsHash;
        string acceptanceCriteria;
        string domain;
        string deliverableUrl;
        JobStatus status;
        uint256 createdAt;
        uint256 deadline;
        uint256 retryCount;
        bytes32 genLayerJobId;
        uint256 verdictAt;
        JobMode mode;
        bytes32 approvedSubmissionId;
    }

    struct Submission {
        bytes32 submissionId;
        bytes32 jobId;
        address freelancer;
        string deliverableUrl;
        uint256 attempt;
        SubmissionStatus status;
        uint256 submittedAt;
        uint256 qualityScore;
        string reasoning;
    }

    struct FreelancerProfile {
        address wallet;
        uint256 reputationPoints;
        uint256 jobsCompleted;
        uint256 jobsFailed;
        uint256 totalEarned;
        string domain;
    }

    uint256 public constant MAX_DISPUTE_WINDOW = 7 days;

    address public owner;
    uint256 public jobNonce;
    bool public globalPaused;
    uint256 public totalEscrowed;
    uint256 public disputeWindow;

    mapping(address => bool) public isOracle;
    mapping(address => bool) public bannedWallets;

    mapping(bytes32 => Job) private jobs;
    mapping(bytes32 => bool) public jobExists;
    mapping(bytes32 => bool) public jobPaused;
    mapping(bytes32 => address[]) private applicants;
    mapping(bytes32 => mapping(address => bool)) public hasApplied;
    mapping(bytes32 => bool) public rewardClaimed;
    mapping(bytes32 => uint256) public verdictQualityScore;
    mapping(bytes32 => Submission) private submissions;
    mapping(bytes32 => bool) public submissionExists;
    mapping(bytes32 => bytes32[]) private jobSubmissions;
    mapping(bytes32 => mapping(address => uint256)) public submissionAttempts;
    mapping(address => FreelancerProfile) private profiles;
    mapping(address => bool) private profileSeen;

    bytes32[] private jobIds;
    address[] private profileWallets;

    event JobPosted(bytes32 indexed jobId, address indexed client, uint256 amount, string domain, address assignedTo);
    event ApplicationSubmitted(bytes32 indexed jobId, address indexed freelancer);
    event JobAccepted(bytes32 indexed jobId, address indexed freelancer);
    event WorkSubmitted(bytes32 indexed jobId, address indexed freelancer, string deliverableUrl);
    event SubmissionRecorded(bytes32 indexed jobId, bytes32 indexed submissionId, address indexed freelancer, uint256 attempt, string deliverableUrl);
    event SubmissionRejected(bytes32 indexed jobId, bytes32 indexed submissionId, address indexed freelancer, string reasoning);
    event ClientApproved(bytes32 indexed jobId, bytes32 indexed submissionId, address indexed freelancer, uint256 qualityScore, string reasoning);
    event VerdictReceived(bytes32 indexed jobId, bool passed, uint8 paymentPct, string reasoning);
    event VerdictOverridden(bytes32 indexed jobId, bool passed, uint8 paymentPct, address indexed by, string reasoning);
    event RewardClaimed(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
    event JobRefunded(bytes32 indexed jobId, address indexed client, uint256 amount, string reason);
    event JobDeleted(bytes32 indexed jobId, address indexed by, uint256 refunded, string reason);
    event EscrowToppedUp(bytes32 indexed jobId, address indexed by, uint256 amount);
    event ReputationAdded(address indexed freelancer, uint256 points, bytes32 jobId);
    event ReputationAdjusted(address indexed wallet, uint256 oldPts, uint256 newPts, address indexed by, string reason);
    event JobFailureRecorded(address indexed freelancer, bytes32 indexed jobId);
    event JobPaused(bytes32 indexed jobId, bool paused);
    event GlobalPaused(bool paused);
    event WalletBanned(address indexed wallet, address indexed by, string reason);
    event WalletUnbanned(address indexed wallet, address indexed by);
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event DisputeWindowChanged(uint256 secondsValue);
    event StuckEthSwept(address indexed to, uint256 amount);

    uint256 private locked = 1;

    modifier nonReentrant() {
        require(locked == 1, "REENTRANT");
        locked = 2;
        _;
        locked = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyOracle() {
        require(isOracle[msg.sender], "ONLY_ORACLE");
        _;
    }

    modifier notBanned() {
        require(!bannedWallets[msg.sender], "BANNED");
        _;
    }

    modifier jobAvailable(bytes32 jobId) {
        require(jobExists[jobId], "JOB_NOT_FOUND");
        require(!globalPaused, "GLOBAL_PAUSED");
        require(!jobPaused[jobId], "JOB_PAUSED");
        _;
    }

    constructor(address initialOracle) {
        require(initialOracle != address(0), "ZERO_ORACLE");
        owner = msg.sender;
        isOracle[initialOracle] = true;
        emit OracleAdded(initialOracle);
    }

    receive() external payable {}

    function postJob(
        string calldata title,
        string calldata specHash,
        string calldata criteria,
        string calldata domain,
        uint256 deadline,
        address assignedFreelancer
    ) external payable notBanned returns (bytes32 jobId) {
        JobMode mode = assignedFreelancer == address(0) ? JobMode.Application : JobMode.Direct;
        return _postJob(title, specHash, criteria, domain, deadline, assignedFreelancer, mode);
    }

    function postJobV3(
        string calldata title,
        string calldata specHash,
        string calldata criteria,
        string calldata domain,
        uint256 deadline,
        address assignedFreelancer,
        JobMode mode
    ) external payable notBanned returns (bytes32 jobId) {
        return _postJob(title, specHash, criteria, domain, deadline, assignedFreelancer, mode);
    }

    function _postJob(
        string calldata title,
        string calldata specHash,
        string calldata criteria,
        string calldata domain,
        uint256 deadline,
        address assignedFreelancer,
        JobMode mode
    ) internal returns (bytes32 jobId) {
        require(msg.value > 0, "ESCROW_REQUIRED");
        require(deadline > block.timestamp, "DEADLINE_IN_PAST");
        require(bytes(title).length > 0, "TITLE_REQUIRED");
        require(bytes(criteria).length > 0, "CRITERIA_REQUIRED");
        if (mode == JobMode.Direct) {
            require(assignedFreelancer != address(0), "DIRECT_ASSIGNEE_REQUIRED");
            require(!bannedWallets[assignedFreelancer], "ASSIGNEE_BANNED");
        } else {
            require(assignedFreelancer == address(0), "ASSIGNEE_NOT_ALLOWED");
        }

        jobId = keccak256(abi.encodePacked(msg.sender, title, block.timestamp, jobNonce++));
        bytes32 genLayerJobId = keccak256(abi.encodePacked("GENLAYER", jobId));

        jobs[jobId] = Job({
            jobId: jobId,
            client: msg.sender,
            assignedFreelancer: assignedFreelancer,
            escrowAmount: msg.value,
            rewardAmount: msg.value,
            title: title,
            specIpfsHash: specHash,
            acceptanceCriteria: criteria,
            domain: domain,
            deliverableUrl: "",
            status: mode == JobMode.Direct ? JobStatus.Active : JobStatus.Open,
            createdAt: block.timestamp,
            deadline: deadline,
            retryCount: 0,
            genLayerJobId: genLayerJobId,
            verdictAt: 0,
            mode: mode,
            approvedSubmissionId: bytes32(0)
        });

        jobExists[jobId] = true;
        jobIds.push(jobId);
        totalEscrowed += msg.value;

        emit JobPosted(jobId, msg.sender, msg.value, domain, assignedFreelancer);
        if (mode == JobMode.Direct) {
            emit JobAccepted(jobId, assignedFreelancer);
        }
    }

    function applyForJob(bytes32 jobId) external jobAvailable(jobId) notBanned {
        Job storage job = jobs[jobId];
        require(msg.sender != job.client, "CLIENT_CANNOT_APPLY");
        require(job.mode != JobMode.Competitive, "COMPETITIVE_NO_APPLICATION");

        if (job.assignedFreelancer != address(0)) {
            require(job.assignedFreelancer == msg.sender, "NOT_ASSIGNED");
            require(job.status == JobStatus.Active, "NOT_ACTIVE");
            emit JobAccepted(jobId, msg.sender);
            return;
        }

        require(job.status == JobStatus.Open, "NOT_OPEN");
        require(!hasApplied[jobId][msg.sender], "ALREADY_APPLIED");
        hasApplied[jobId][msg.sender] = true;
        applicants[jobId].push(msg.sender);
        emit ApplicationSubmitted(jobId, msg.sender);
    }

    function acceptApplication(bytes32 jobId, address freelancer) external jobAvailable(jobId) notBanned {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client, "ONLY_CLIENT");
        require(job.mode == JobMode.Application, "NOT_APPLICATION_JOB");
        require(job.status == JobStatus.Open, "NOT_OPEN");
        require(hasApplied[jobId][freelancer], "NO_APPLICATION");
        require(freelancer != address(0), "ZERO_FREELANCER");
        require(!bannedWallets[freelancer], "FREELANCER_BANNED");

        job.assignedFreelancer = freelancer;
        job.status = JobStatus.Active;
        emit JobAccepted(jobId, freelancer);
    }

    function submitWork(bytes32 jobId, string calldata deliverableUrl) external jobAvailable(jobId) notBanned returns (bytes32 submissionId) {
        Job storage job = jobs[jobId];
        require(block.timestamp <= job.deadline, "DEADLINE_PASSED");
        require(bytes(deliverableUrl).length > 0, "URL_REQUIRED");
        require(submissionAttempts[jobId][msg.sender] < 3, "MAX_ATTEMPTS");

        if (job.mode == JobMode.Competitive) {
            require(job.status == JobStatus.Open || job.status == JobStatus.UnderReview || job.status == JobStatus.AwaitingApproval, "NOT_SUBMITTABLE");
            require(msg.sender != job.client, "CLIENT_CANNOT_SUBMIT");
        } else {
            require(job.assignedFreelancer == msg.sender, "ONLY_FREELANCER");
            require(
                job.status == JobStatus.Active ||
                job.status == JobStatus.UnderReview ||
                job.status == JobStatus.Failed ||
                job.status == JobStatus.AwaitingApproval,
                "NOT_SUBMITTABLE"
            );
        }

        job.deliverableUrl = deliverableUrl;
        job.status = JobStatus.UnderReview;
        uint256 attempt = ++submissionAttempts[jobId][msg.sender];
        submissionId = keccak256(abi.encodePacked(jobId, msg.sender, attempt, deliverableUrl));
        submissions[submissionId] = Submission({
            submissionId: submissionId,
            jobId: jobId,
            freelancer: msg.sender,
            deliverableUrl: deliverableUrl,
            attempt: attempt,
            status: SubmissionStatus.UnderReview,
            submittedAt: block.timestamp,
            qualityScore: 0,
            reasoning: ""
        });
        submissionExists[submissionId] = true;
        jobSubmissions[jobId].push(submissionId);
        emit WorkSubmitted(jobId, msg.sender, deliverableUrl);
        emit SubmissionRecorded(jobId, submissionId, msg.sender, attempt, deliverableUrl);
    }

    function approveSubmission(
        bytes32 jobId,
        bytes32 submissionId,
        uint8 qualityScore,
        string calldata reasoning
    ) external jobAvailable(jobId) notBanned {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client, "ONLY_CLIENT");
        require(submissionExists[submissionId], "SUBMISSION_NOT_FOUND");
        Submission storage submission = submissions[submissionId];
        require(submission.jobId == jobId, "WRONG_JOB");
        require(submission.status == SubmissionStatus.UnderReview, "SUBMISSION_RESOLVED");
        if (job.mode == JobMode.Competitive) {
            require(block.timestamp > job.deadline, "COMPETITION_ACTIVE");
        }

        submission.status = SubmissionStatus.Approved;
        submission.qualityScore = qualityScore;
        submission.reasoning = reasoning;
        job.assignedFreelancer = submission.freelancer;
        job.deliverableUrl = submission.deliverableUrl;
        job.approvedSubmissionId = submissionId;
        job.rewardAmount = job.escrowAmount;
        job.status = JobStatus.Passed;
        job.verdictAt = block.timestamp;
        verdictQualityScore[jobId] = qualityScore;
        emit ClientApproved(jobId, submissionId, submission.freelancer, qualityScore, reasoning);
        emit VerdictReceived(jobId, true, qualityScore, reasoning);
    }

    function rejectSubmission(bytes32 jobId, bytes32 submissionId, string calldata reasoning) external jobAvailable(jobId) notBanned {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client, "ONLY_CLIENT");
        require(job.mode != JobMode.Competitive, "COMPETITIVE_RANKING_FINAL");
        require(submissionExists[submissionId], "SUBMISSION_NOT_FOUND");
        Submission storage submission = submissions[submissionId];
        require(submission.jobId == jobId, "WRONG_JOB");
        require(submission.status == SubmissionStatus.UnderReview, "SUBMISSION_RESOLVED");

        submission.status = SubmissionStatus.Rejected;
        submission.reasoning = reasoning;
        job.retryCount = submissionAttempts[jobId][submission.freelancer];
        job.status = job.retryCount >= 3 ? JobStatus.AwaitingApproval : JobStatus.Failed;
        _recordFailedJob(submission.freelancer, jobId, job.domain);
        emit SubmissionRejected(jobId, submissionId, submission.freelancer, reasoning);
        emit VerdictReceived(jobId, false, 0, reasoning);
    }

    function receiveVerdict(
        bytes32 jobId,
        bool passed,
        uint8 paymentPct,
        string calldata reasoning
    ) external onlyOracle nonReentrant jobAvailable(jobId) {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.UnderReview, "NOT_UNDER_REVIEW");
        require(paymentPct <= 100, "BAD_PAYMENT_PCT");

        emit VerdictReceived(jobId, passed, paymentPct, reasoning);

        if (passed) {
            uint256 pct = paymentPct == 0 ? 100 : paymentPct;
            job.rewardAmount = (job.escrowAmount * pct) / 100;
            verdictQualityScore[jobId] = pct;
            job.status = JobStatus.AwaitingApproval;
            job.verdictAt = block.timestamp;
            return;
        }

        job.retryCount += 1;
        job.verdictAt = block.timestamp;
        _recordFailedJob(job.assignedFreelancer, jobId, job.domain);
        if (job.retryCount >= 3) {
            _refund(jobId, "Max retries reached");
        } else {
            job.status = JobStatus.Failed;
        }
    }

    function overrideVerdict(
        bytes32 jobId,
        bool passed,
        uint8 paymentPct,
        string calldata reasoning
    ) external onlyOwner nonReentrant {
        require(jobExists[jobId], "JOB_NOT_FOUND");
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.UnderReview ||
            job.status == JobStatus.Failed ||
            job.status == JobStatus.Passed ||
            job.status == JobStatus.Active,
            "NOT_OVERRIDABLE"
        );
        require(paymentPct <= 100, "BAD_PAYMENT_PCT");
        require(!rewardClaimed[jobId], "ALREADY_CLAIMED");

        if (passed) {
            uint256 pct = paymentPct == 0 ? 100 : paymentPct;
            job.rewardAmount = (job.escrowAmount * pct) / 100;
            verdictQualityScore[jobId] = pct;
            job.status = JobStatus.AwaitingApproval;
        } else {
            job.status = JobStatus.Failed;
        }
        job.verdictAt = block.timestamp;
        emit VerdictOverridden(jobId, passed, paymentPct, msg.sender, reasoning);
    }

    function claimReward(bytes32 jobId) external nonReentrant jobAvailable(jobId) notBanned {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Passed, "NOT_CLIENT_APPROVED");
        require(job.assignedFreelancer == msg.sender, "ONLY_FREELANCER");
        require(!rewardClaimed[jobId], "ALREADY_CLAIMED");
        require(block.timestamp >= job.verdictAt + disputeWindow, "DISPUTE_WINDOW");

        rewardClaimed[jobId] = true;
        job.status = JobStatus.Complete;
        uint256 amount = job.rewardAmount;
        uint256 escrow = job.escrowAmount;
        uint256 remainder = escrow - amount;
        job.escrowAmount = 0;
        totalEscrowed -= escrow;

        uint256 points = _recordCompletedJob(msg.sender, verdictQualityScore[jobId], job.retryCount == 0, amount, job.domain);
        emit ReputationAdded(msg.sender, points, jobId);

        (bool paid, ) = msg.sender.call{value: amount}("");
        require(paid, "REWARD_TRANSFER_FAILED");
        if (remainder > 0) {
            (bool refunded, ) = job.client.call{value: remainder}("");
            require(refunded, "REMAINDER_REFUND_FAILED");
        }
        emit RewardClaimed(jobId, msg.sender, amount);
    }

    function autoRefund(bytes32 jobId) external onlyOracle nonReentrant jobAvailable(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status != JobStatus.AwaitingApproval &&
            job.status != JobStatus.Passed &&
            job.status != JobStatus.Complete &&
            job.status != JobStatus.Refunded &&
            job.status != JobStatus.Deleted,
            "NOT_REFUNDABLE"
        );
        require(block.timestamp > job.deadline || job.retryCount >= 3, "REFUND_NOT_DUE");
        _refund(jobId, block.timestamp > job.deadline ? "Deadline passed" : "Max retries reached");
    }

    function cancelJob(bytes32 jobId) external nonReentrant jobAvailable(jobId) notBanned {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client, "ONLY_CLIENT");
        require(job.status == JobStatus.Open, "NOT_OPEN");
        _refund(jobId, "Client cancelled open job");
    }

    function topUpEscrow(bytes32 jobId) external payable jobAvailable(jobId) notBanned {
        require(msg.value > 0, "ZERO_TOPUP");
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Open ||
            job.status == JobStatus.Active ||
            job.status == JobStatus.UnderReview ||
            job.status == JobStatus.Failed ||
            job.status == JobStatus.AwaitingApproval,
            "TOPUP_NOT_ALLOWED"
        );
        job.escrowAmount += msg.value;
        job.rewardAmount += msg.value;
        totalEscrowed += msg.value;
        emit EscrowToppedUp(jobId, msg.sender, msg.value);
    }

    function pauseJob(bytes32 jobId, bool paused) external onlyOwner {
        require(jobExists[jobId], "JOB_NOT_FOUND");
        jobPaused[jobId] = paused;
        emit JobPaused(jobId, paused);
    }

    function adminForceRefund(bytes32 jobId, string calldata reason) external onlyOwner nonReentrant {
        require(jobExists[jobId], "JOB_NOT_FOUND");
        Job storage job = jobs[jobId];
        require(
            job.status != JobStatus.Complete &&
            job.status != JobStatus.Refunded &&
            job.status != JobStatus.Deleted,
            "NOT_REFUNDABLE"
        );
        _refund(jobId, reason);
    }

    function deleteJob(bytes32 jobId, string calldata reason) external onlyOwner nonReentrant {
        require(jobExists[jobId], "JOB_NOT_FOUND");
        Job storage job = jobs[jobId];
        require(
            job.status != JobStatus.Complete &&
            job.status != JobStatus.Refunded &&
            job.status != JobStatus.Deleted,
            "TERMINAL"
        );

        uint256 amount = job.escrowAmount;
        if (amount > 0) {
            job.escrowAmount = 0;
            job.rewardAmount = 0;
            totalEscrowed -= amount;
            (bool ok, ) = job.client.call{value: amount}("");
            require(ok, "REFUND_TRANSFER_FAILED");
        }
        job.status = JobStatus.Deleted;
        emit JobDeleted(jobId, msg.sender, amount, reason);
    }

    function banUser(address wallet, string calldata reason) external onlyOwner {
        require(wallet != address(0), "ZERO_WALLET");
        require(wallet != owner, "CANNOT_BAN_OWNER");
        bannedWallets[wallet] = true;
        emit WalletBanned(wallet, msg.sender, reason);
    }

    function unbanUser(address wallet) external onlyOwner {
        bannedWallets[wallet] = false;
        emit WalletUnbanned(wallet, msg.sender);
    }

    function setReputation(address wallet, uint256 newPoints, string calldata reason) external onlyOwner {
        require(wallet != address(0), "ZERO_WALLET");
        _ensureProfile(wallet, "");
        uint256 oldPts = profiles[wallet].reputationPoints;
        profiles[wallet].reputationPoints = newPoints;
        emit ReputationAdjusted(wallet, oldPts, newPoints, msg.sender, reason);
    }

    function addOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "ZERO_ORACLE");
        require(!isOracle[newOracle], "ALREADY_ORACLE");
        isOracle[newOracle] = true;
        emit OracleAdded(newOracle);
    }

    function removeOracle(address oldOracle) external onlyOwner {
        require(isOracle[oldOracle], "NOT_ORACLE");
        isOracle[oldOracle] = false;
        emit OracleRemoved(oldOracle);
    }

    function setDisputeWindow(uint256 secondsValue) external onlyOwner {
        require(secondsValue <= MAX_DISPUTE_WINDOW, "WINDOW_TOO_LONG");
        disputeWindow = secondsValue;
        emit DisputeWindowChanged(secondsValue);
    }

    function setGlobalPaused(bool paused) external onlyOwner {
        globalPaused = paused;
        emit GlobalPaused(paused);
    }

    function sweepStuckEth(address to) external onlyOwner nonReentrant {
        require(to != address(0), "ZERO_TO");
        uint256 balance = address(this).balance;
        require(balance > totalEscrowed, "NO_STUCK_ETH");
        uint256 amount = balance - totalEscrowed;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "SWEEP_FAILED");
        emit StuckEthSwept(to, amount);
    }

    function getJob(bytes32 jobId) external view returns (Job memory) {
        require(jobExists[jobId], "JOB_NOT_FOUND");
        return jobs[jobId];
    }

    function getJobIds() external view returns (bytes32[] memory) {
        return jobIds;
    }

    function getApplicants(bytes32 jobId) external view returns (address[] memory) {
        require(jobExists[jobId], "JOB_NOT_FOUND");
        return applicants[jobId];
    }

    function getSubmission(bytes32 submissionId) external view returns (Submission memory) {
        require(submissionExists[submissionId], "SUBMISSION_NOT_FOUND");
        return submissions[submissionId];
    }

    function getJobSubmissions(bytes32 jobId) external view returns (bytes32[] memory) {
        require(jobExists[jobId], "JOB_NOT_FOUND");
        return jobSubmissions[jobId];
    }

    function getProfile(address wallet) external view returns (FreelancerProfile memory) {
        return profiles[wallet];
    }

    function getWalletCount() external view returns (uint256) {
        return profileWallets.length;
    }

    function getTopFreelancers(uint256 limit) external view returns (FreelancerProfile[] memory) {
        uint256 count = profileWallets.length;
        if (limit < count) {
            count = limit;
        }

        FreelancerProfile[] memory sorted = new FreelancerProfile[](profileWallets.length);
        for (uint256 i = 0; i < profileWallets.length; i++) {
            sorted[i] = profiles[profileWallets[i]];
        }

        for (uint256 i = 0; i < sorted.length; i++) {
            for (uint256 j = i + 1; j < sorted.length; j++) {
                if (sorted[j].reputationPoints > sorted[i].reputationPoints) {
                    FreelancerProfile memory tmp = sorted[i];
                    sorted[i] = sorted[j];
                    sorted[j] = tmp;
                }
            }
        }

        FreelancerProfile[] memory top = new FreelancerProfile[](count);
        for (uint256 i = 0; i < count; i++) {
            top[i] = sorted[i];
        }
        return top;
    }

    function _refund(bytes32 jobId, string memory reason) internal {
        Job storage job = jobs[jobId];
        uint256 amount = job.escrowAmount;
        job.escrowAmount = 0;
        job.rewardAmount = 0;
        job.status = JobStatus.Refunded;
        if (amount > 0) {
            totalEscrowed -= amount;
            (bool ok, ) = job.client.call{value: amount}("");
            require(ok, "REFUND_TRANSFER_FAILED");
        }
        emit JobRefunded(jobId, job.client, amount, reason);
    }

    function _recordCompletedJob(
        address freelancer,
        uint256 qualityScore,
        bool firstTry,
        uint256 earnedWei,
        string memory domain
    ) internal returns (uint256 points) {
        _ensureProfile(freelancer, domain);
        points = _pointsForScore(qualityScore);
        if (firstTry) {
            points += 10;
        }

        FreelancerProfile storage profile = profiles[freelancer];
        profile.reputationPoints += points;
        profile.jobsCompleted += 1;
        profile.totalEarned += earnedWei;
    }

    function _recordFailedJob(address freelancer, bytes32 jobId, string memory domain) internal {
        _ensureProfile(freelancer, domain);
        profiles[freelancer].jobsFailed += 1;
        emit JobFailureRecorded(freelancer, jobId);
    }

    function _pointsForScore(uint256 qualityScore) internal pure returns (uint256) {
        if (qualityScore >= 90) return 50;
        if (qualityScore >= 75) return 30;
        if (qualityScore >= 60) return 15;
        return 0;
    }

    function _ensureProfile(address wallet, string memory domain) internal {
        if (profileSeen[wallet]) {
            if (bytes(profiles[wallet].domain).length == 0 && bytes(domain).length > 0) {
                profiles[wallet].domain = domain;
            }
            return;
        }
        profileSeen[wallet] = true;
        profileWallets.push(wallet);
        profiles[wallet].wallet = wallet;
        profiles[wallet].domain = domain;
    }
}
