// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract WorkProof {
    enum JobStatus {
        Open,
        Active,
        UnderReview,
        Failed,
        Passed,
        Complete,
        Refunded
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
    }

    struct FreelancerProfile {
        address wallet;
        uint256 reputationPoints;
        uint256 jobsCompleted;
        uint256 jobsFailed;
        uint256 totalEarned;
        string domain;
    }

    address public owner;
    address public oracle;
    uint256 public jobNonce;
    bool public globalPaused;

    mapping(bytes32 => Job) private jobs;
    mapping(bytes32 => bool) public jobExists;
    mapping(bytes32 => bool) public jobPaused;
    mapping(bytes32 => address[]) private applicants;
    mapping(bytes32 => mapping(address => bool)) public hasApplied;
    mapping(bytes32 => bool) public rewardClaimed;
    mapping(bytes32 => uint256) public verdictQualityScore;
    mapping(address => FreelancerProfile) private profiles;
    mapping(address => bool) private profileSeen;

    bytes32[] private jobIds;
    address[] private profileWallets;

    event JobPosted(bytes32 indexed jobId, address indexed client, uint256 amount, string domain, address assignedTo);
    event ApplicationSubmitted(bytes32 indexed jobId, address indexed freelancer);
    event JobAccepted(bytes32 indexed jobId, address indexed freelancer);
    event WorkSubmitted(bytes32 indexed jobId, address indexed freelancer, string deliverableUrl);
    event VerdictReceived(bytes32 indexed jobId, bool passed, uint8 paymentPct, string reasoning);
    event RewardClaimed(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
    event JobRefunded(bytes32 indexed jobId, address indexed client, uint256 amount, string reason);
    event ReputationAdded(address indexed freelancer, uint256 points, bytes32 jobId);
    event JobFailureRecorded(address indexed freelancer, bytes32 indexed jobId);
    event JobPaused(bytes32 indexed jobId, bool paused);
    event GlobalPaused(bool paused);
    event OracleUpdated(address indexed oracle);

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
        require(msg.sender == oracle, "ONLY_ORACLE");
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
        oracle = initialOracle;
    }

    receive() external payable {}

    function postJob(
        string calldata title,
        string calldata specHash,
        string calldata criteria,
        string calldata domain,
        uint256 deadline,
        address assignedFreelancer
    ) external payable returns (bytes32 jobId) {
        require(msg.value > 0, "ESCROW_REQUIRED");
        require(deadline > block.timestamp, "DEADLINE_IN_PAST");
        require(bytes(title).length > 0, "TITLE_REQUIRED");
        require(bytes(criteria).length > 0, "CRITERIA_REQUIRED");

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
            status: assignedFreelancer == address(0) ? JobStatus.Open : JobStatus.Active,
            createdAt: block.timestamp,
            deadline: deadline,
            retryCount: 0,
            genLayerJobId: genLayerJobId
        });

        jobExists[jobId] = true;
        jobIds.push(jobId);

        emit JobPosted(jobId, msg.sender, msg.value, domain, assignedFreelancer);
        if (assignedFreelancer != address(0)) {
            emit JobAccepted(jobId, assignedFreelancer);
        }
    }

    function applyForJob(bytes32 jobId) external jobAvailable(jobId) {
        Job storage job = jobs[jobId];
        require(msg.sender != job.client, "CLIENT_CANNOT_APPLY");

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

    function acceptApplication(bytes32 jobId, address freelancer) external jobAvailable(jobId) {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client, "ONLY_CLIENT");
        require(job.status == JobStatus.Open, "NOT_OPEN");
        require(hasApplied[jobId][freelancer], "NO_APPLICATION");
        require(freelancer != address(0), "ZERO_FREELANCER");

        job.assignedFreelancer = freelancer;
        job.status = JobStatus.Active;
        emit JobAccepted(jobId, freelancer);
    }

    function submitWork(bytes32 jobId, string calldata deliverableUrl) external jobAvailable(jobId) {
        Job storage job = jobs[jobId];
        require(job.assignedFreelancer == msg.sender, "ONLY_FREELANCER");
        require(job.status == JobStatus.Active || job.status == JobStatus.Failed, "NOT_SUBMITTABLE");
        require(block.timestamp <= job.deadline, "DEADLINE_PASSED");
        require(bytes(deliverableUrl).length > 0, "URL_REQUIRED");

        job.deliverableUrl = deliverableUrl;
        job.status = JobStatus.UnderReview;
        emit WorkSubmitted(jobId, msg.sender, deliverableUrl);
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
            job.status = JobStatus.Passed;
            return;
        }

        job.retryCount += 1;
        _recordFailedJob(job.assignedFreelancer, jobId, job.domain);
        if (job.retryCount >= 3) {
            _refund(jobId, "Max retries reached");
        } else {
            job.status = JobStatus.Failed;
        }
    }

    function claimReward(bytes32 jobId) external nonReentrant jobAvailable(jobId) {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Passed, "NOT_PASSED");
        require(job.assignedFreelancer == msg.sender, "ONLY_FREELANCER");
        require(!rewardClaimed[jobId], "ALREADY_CLAIMED");

        rewardClaimed[jobId] = true;
        job.status = JobStatus.Complete;
        uint256 amount = job.rewardAmount;
        uint256 remainder = job.escrowAmount - amount;
        job.escrowAmount = 0;

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
        require(job.status != JobStatus.Passed && job.status != JobStatus.Complete && job.status != JobStatus.Refunded, "NOT_REFUNDABLE");
        require(block.timestamp > job.deadline || job.retryCount >= 3, "REFUND_NOT_DUE");
        _refund(jobId, block.timestamp > job.deadline ? "Deadline passed" : "Max retries reached");
    }

    function cancelJob(bytes32 jobId) external nonReentrant jobAvailable(jobId) {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client, "ONLY_CLIENT");
        require(job.status == JobStatus.Open, "NOT_OPEN");
        _refund(jobId, "Client cancelled open job");
    }

    function pauseJob(bytes32 jobId, bool paused) external onlyOwner {
        require(jobExists[jobId], "JOB_NOT_FOUND");
        jobPaused[jobId] = paused;
        emit JobPaused(jobId, paused);
    }

    function adminForceRefund(bytes32 jobId, string calldata reason) external onlyOwner nonReentrant {
        require(jobExists[jobId], "JOB_NOT_FOUND");
        Job storage job = jobs[jobId];
        require(job.status != JobStatus.Complete && job.status != JobStatus.Refunded, "NOT_REFUNDABLE");
        _refund(jobId, reason);
    }

    function setGlobalPaused(bool paused) external onlyOwner {
        globalPaused = paused;
        emit GlobalPaused(paused);
    }

    function setOracle(address nextOracle) external onlyOwner {
        require(nextOracle != address(0), "ZERO_ORACLE");
        oracle = nextOracle;
        emit OracleUpdated(nextOracle);
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
        (bool ok, ) = job.client.call{value: amount}("");
        require(ok, "REFUND_TRANSFER_FAILED");
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
