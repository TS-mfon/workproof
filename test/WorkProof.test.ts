import { expect } from "chai";
import { ethers } from "hardhat";

const oneEth = ethers.parseEther("1");

async function fixture() {
  const [owner, oracle, client, freelancer, competitor, other] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("WorkProof");
  const contract = await Factory.deploy(oracle.address);
  return { owner, oracle, client, freelancer, competitor, other, contract };
}

async function postedJob(
  contract: any,
  client: any,
  mode: 0 | 1 | 2,
  assigned = ethers.ZeroAddress,
  deadlineOffset = 86400
) {
  const tx = await contract.connect(client).postJobV3(
    mode === 2 ? "Competitive writing brief" : "Assigned writing brief",
    "ipfs://spec",
    "Write a complete public deliverable that satisfies every acceptance criterion.",
    "content",
    (await ethers.provider.getBlock("latest"))!.timestamp + deadlineOffset,
    assigned,
    mode,
    { value: oneEth }
  );
  const receipt = await tx.wait();
  return receipt.logs
    .map((log: any) => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    })
    .find((log: any) => log?.name === "JobPosted").args.jobId;
}

async function submissionId(contract: any, signer: any, jobId: string, url: string) {
  const tx = await contract.connect(signer).submitWork(jobId, url);
  const receipt = await tx.wait();
  return receipt.logs
    .map((log: any) => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    })
    .find((log: any) => log?.name === "SubmissionRecorded").args.submissionId;
}

describe("WorkProof V3", () => {
  it("requires client approval before an assigned freelancer can claim", async () => {
    const { client, freelancer, contract } = await fixture();
    const jobId = await postedJob(contract, client, 1, freelancer.address);
    const subId = await submissionId(contract, freelancer, jobId, "https://example.com/work");

    await expect(contract.connect(freelancer).claimReward(jobId)).to.be.revertedWith("NOT_CLIENT_APPROVED");
    await expect(contract.connect(client).approveSubmission(jobId, subId, 92, "GenLayer passed; client accepted"))
      .to.emit(contract, "ClientApproved")
      .withArgs(jobId, subId, freelancer.address, 92, "GenLayer passed; client accepted");
    await expect(contract.connect(freelancer).claimReward(jobId)).to.emit(contract, "RewardClaimed");

    const profile = await contract.getProfile(freelancer.address);
    expect(profile.jobsCompleted).to.equal(1);
    expect(profile.reputationPoints).to.equal(60);
    expect(await contract.totalEscrowed()).to.equal(0);
  });

  it("preserves application jobs and lets the selected freelancer submit", async () => {
    const { client, freelancer, competitor, contract } = await fixture();
    const jobId = await postedJob(contract, client, 0);
    await contract.connect(freelancer).applyForJob(jobId);
    await contract.connect(client).acceptApplication(jobId, freelancer.address);
    await expect(contract.connect(competitor).submitWork(jobId, "https://example.com/no"))
      .to.be.revertedWith("ONLY_FREELANCER");
    await expect(contract.connect(freelancer).submitWork(jobId, "https://example.com/yes"))
      .to.emit(contract, "SubmissionRecorded");
  });

  it("accepts multiple competitive submissions and only approves after deadline", async () => {
    const { client, freelancer, competitor, contract } = await fixture();
    const jobId = await postedJob(contract, client, 2, ethers.ZeroAddress, 60);
    const first = await submissionId(contract, freelancer, jobId, "https://example.com/first");
    const second = await submissionId(contract, competitor, jobId, "https://example.com/better");

    expect((await contract.getJobSubmissions(jobId)).length).to.equal(2);
    await expect(contract.connect(client).approveSubmission(jobId, second, 95, "Highest passing GenLayer score"))
      .to.be.revertedWith("COMPETITION_ACTIVE");

    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine", []);
    await contract.connect(client).approveSubmission(jobId, second, 95, "Highest passing GenLayer score");

    const job = await contract.getJob(jobId);
    expect(job.assignedFreelancer).to.equal(competitor.address);
    expect(job.approvedSubmissionId).to.equal(second);
    await expect(contract.connect(freelancer).claimReward(jobId)).to.be.revertedWith("ONLY_FREELANCER");
    await expect(contract.connect(competitor).claimReward(jobId)).to.emit(contract, "RewardClaimed");
    expect((await contract.getSubmission(first)).status).to.equal(0);
  });

  it("limits each freelancer to three submissions", async () => {
    const { client, freelancer, contract } = await fixture();
    const jobId = await postedJob(contract, client, 2);
    for (let i = 0; i < 3; i++) {
      await contract.connect(freelancer).submitWork(jobId, `https://example.com/${i}`);
    }
    await expect(contract.connect(freelancer).submitWork(jobId, "https://example.com/4"))
      .to.be.revertedWith("MAX_ATTEMPTS");
  });

  it("allows client rejection and retry for assigned jobs", async () => {
    const { client, freelancer, contract } = await fixture();
    const jobId = await postedJob(contract, client, 1, freelancer.address);
    const first = await submissionId(contract, freelancer, jobId, "https://example.com/first");
    await expect(contract.connect(client).rejectSubmission(jobId, first, "GenLayer failed"))
      .to.emit(contract, "SubmissionRejected");
    expect((await contract.getJob(jobId)).status).to.equal(3);
    await expect(contract.connect(freelancer).submitWork(jobId, "https://example.com/retry"))
      .to.emit(contract, "SubmissionRecorded");
  });

  it("keeps competitive escrow locked when the client is inactive", async () => {
    const { oracle, client, freelancer, contract } = await fixture();
    const jobId = await postedJob(contract, client, 2, ethers.ZeroAddress, 5);
    await contract.connect(freelancer).submitWork(jobId, "https://example.com/work");
    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);
    await expect(contract.connect(oracle).autoRefund(jobId)).to.be.revertedWith("NOT_REFUNDABLE");
    expect(await contract.totalEscrowed()).to.equal(oneEth);
  });

  it("keeps admin pause, delete, ban, top-up, and reputation controls", async () => {
    const { owner, client, freelancer, other, contract } = await fixture();
    const jobId = await postedJob(contract, client, 0);
    await contract.connect(owner).pauseJob(jobId, true);
    await expect(contract.connect(freelancer).applyForJob(jobId)).to.be.revertedWith("JOB_PAUSED");
    await contract.connect(owner).pauseJob(jobId, false);
    await contract.connect(client).topUpEscrow(jobId, { value: oneEth });
    expect(await contract.totalEscrowed()).to.equal(oneEth * 2n);
    await contract.connect(owner).banUser(other.address, "abuse");
    expect(await contract.bannedWallets(other.address)).to.equal(true);
    await contract.connect(owner).setReputation(freelancer.address, 250, "migration");
    expect((await contract.getProfile(freelancer.address)).reputationPoints).to.equal(250);
    await expect(contract.connect(owner).deleteJob(jobId, "reset")).to.emit(contract, "JobDeleted");
  });
});
