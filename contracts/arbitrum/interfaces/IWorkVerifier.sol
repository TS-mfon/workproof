// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWorkVerifier {
    function verify_work(
        string calldata jobId,
        string calldata deliverableUrl,
        string calldata acceptanceCriteria,
        uint256 retryCount
    ) external;

    function get_verdict(string calldata jobId) external view returns (bytes memory);

    function mark_verdict_emitted(string calldata jobId) external;
}
