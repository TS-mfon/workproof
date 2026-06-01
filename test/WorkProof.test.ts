import { expect } from "chai";
import { ethers } from "hardhat";

const oneEth = ethers.parseEther("1");

async function deployFixture() {
  const [owner, oracle, client, freelancer, other] = await ethers.getSigners();
  const WorkProof = await ethers.getContractFactory("WorkProof");
  const workProof = await WorkProof.deploy(oracle.address);
  return { owner, oracle, client, freelancer, other, workProof };
}

async function postOpenJob(workProof: any, client: any) {
  const tx = await workProof.connect(client).postJob(
    "Landing page",
    "ipfs://spec",
    "Build a responsive landing page",
    "frontend",
    Math.floor(Date.now() / 1000) + 86400,
    ethers.ZeroAddress,
    { value: oneEth }
  );
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((log: any) => {
      try {
        return workProof.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((log: any) => log?.name === "JobPosted");
  return event.args.jobId;
}

describe("WorkProof", () => {
  it("posts, accepts, submits, passes, claims, and records reputation", async () => {
    const { oracle, client, freelancer, workProof } = await deployFixture();
    const jobId = await postOpenJob(workProof, client);

    await workProof.connect(freelancer).applyForJob(jobId);
    await workProof.connect(client).acceptApplication(jobId, freelancer.address);
    await workProof.connect(freelancer).submitWork(jobId, "https://example.com/work");
    await workProof.connect(oracle).receiveVerdict(jobId, true, 90, "Approved");

    await expect(workProof.connect(freelancer).claimReward(jobId))
      .to.emit(workProof, "RewardClaimed")
      .withArgs(jobId, freelancer.address, ethers.parseEther("0.9"));

    const job = await workProof.getJob(jobId);
    expect(job.status).to.equal(5);
    const profile = await workProof.getProfile(freelancer.address);
    expect(profile.jobsCompleted).to.equal(1);
    expect(profile.reputationPoints).to.equal(60);
    expect(profile.domain).to.equal("frontend");
  });

  it("increments retries and refunds after third failed verdict", async () => {
    const { oracle, client, freelancer, workProof } = await deployFixture();
    const jobId = await postOpenJob(workProof, client);
    await workProof.connect(freelancer).applyForJob(jobId);
    await workProof.connect(client).acceptApplication(jobId, freelancer.address);

    for (let i = 0; i < 3; i++) {
      await workProof.connect(freelancer).submitWork(jobId, `https://example.com/work-${i}`);
      await workProof.connect(oracle).receiveVerdict(jobId, false, 0, "Rejected");
    }

    const job = await workProof.getJob(jobId);
    expect(job.status).to.equal(6);
    expect(job.retryCount).to.equal(3);
    expect(job.escrowAmount).to.equal(0);
    const profile = await workProof.getProfile(freelancer.address);
    expect(profile.jobsFailed).to.equal(3);
  });

  it("allows oracle deadline refund", async () => {
    const { oracle, client, freelancer, workProof } = await deployFixture();
    const tx = await workProof.connect(client).postJob(
      "Short job",
      "ipfs://spec",
      "Do it quickly",
      "content",
      Math.floor(Date.now() / 1000) + 2,
      freelancer.address,
      { value: oneEth }
    );
    const receipt = await tx.wait();
    const jobId = workProof.interface.parseLog(receipt.logs[0]).args.jobId;

    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);
    await expect(workProof.connect(oracle).autoRefund(jobId)).to.emit(workProof, "JobRefunded");
  });

  it("lets admin pause and force refund", async () => {
    const { owner, client, freelancer, workProof } = await deployFixture();
    const jobId = await postOpenJob(workProof, client);
    await workProof.connect(owner).pauseJob(jobId, true);
    await expect(workProof.connect(freelancer).applyForJob(jobId)).to.be.revertedWith("JOB_PAUSED");
    await workProof.connect(owner).pauseJob(jobId, false);
    await expect(workProof.connect(owner).adminForceRefund(jobId, "Admin refund")).to.emit(workProof, "JobRefunded");
  });

  it("returns top freelancers from WorkProof reputation", async () => {
    const { oracle, client, freelancer, other, workProof } = await deployFixture();
    const firstJob = await postOpenJob(workProof, client);
    await workProof.connect(freelancer).applyForJob(firstJob);
    await workProof.connect(client).acceptApplication(firstJob, freelancer.address);
    await workProof.connect(freelancer).submitWork(firstJob, "https://example.com/a");
    await workProof.connect(oracle).receiveVerdict(firstJob, true, 95, "Great");
    await workProof.connect(freelancer).claimReward(firstJob);

    const secondJob = await postOpenJob(workProof, client);
    await workProof.connect(other).applyForJob(secondJob);
    await workProof.connect(client).acceptApplication(secondJob, other.address);
    await workProof.connect(other).submitWork(secondJob, "https://example.com/b");
    await workProof.connect(oracle).receiveVerdict(secondJob, true, 75, "Good");
    await workProof.connect(other).claimReward(secondJob);

    const top = await workProof.getTopFreelancers(2);
    expect(top[0].wallet).to.equal(freelancer.address);
    expect(top[0].reputationPoints).to.equal(60);
    expect(top[1].wallet).to.equal(other.address);
  });
});
