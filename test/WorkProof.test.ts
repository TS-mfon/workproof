import { expect } from "chai";
import { ethers } from "hardhat";

const oneEth = ethers.parseEther("1");

async function deployFixture() {
  const [owner, oracle, client, freelancer, other, treasury] = await ethers.getSigners();
  const WorkProof = await ethers.getContractFactory("WorkProof");
  const workProof = await WorkProof.deploy(oracle.address);
  return { owner, oracle, client, freelancer, other, treasury, workProof };
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
    expect(await workProof.totalEscrowed()).to.equal(0);
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
    expect(await workProof.totalEscrowed()).to.equal(0);
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
    expect(await workProof.totalEscrowed()).to.equal(0);
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

  describe("ban / unban", () => {
    it("blocks banned wallets from every state-changing call", async () => {
      const { owner, client, freelancer, workProof } = await deployFixture();
      const jobId = await postOpenJob(workProof, client);

      await workProof.connect(owner).banUser(freelancer.address, "Test ban");
      expect(await workProof.bannedWallets(freelancer.address)).to.equal(true);

      await expect(workProof.connect(freelancer).applyForJob(jobId))
        .to.be.revertedWith("BANNED");
      await expect(
        workProof.connect(freelancer).postJob("x", "y", "z", "d", Math.floor(Date.now() / 1000) + 86400, ethers.ZeroAddress, { value: oneEth })
      ).to.be.revertedWith("BANNED");
    });

    it("unban restores access", async () => {
      const { owner, client, freelancer, workProof } = await deployFixture();
      const jobId = await postOpenJob(workProof, client);

      await workProof.connect(owner).banUser(freelancer.address, "Test ban");
      await workProof.connect(owner).unbanUser(freelancer.address);
      await expect(workProof.connect(freelancer).applyForJob(jobId)).to.emit(workProof, "ApplicationSubmitted");
    });

    it("cannot ban owner", async () => {
      const { owner, workProof } = await deployFixture();
      await expect(workProof.connect(owner).banUser(owner.address, "x")).to.be.revertedWith("CANNOT_BAN_OWNER");
    });

    it("acceptApplication rejects banned freelancer", async () => {
      const { owner, client, freelancer, workProof } = await deployFixture();
      const jobId = await postOpenJob(workProof, client);
      await workProof.connect(freelancer).applyForJob(jobId);
      await workProof.connect(owner).banUser(freelancer.address, "x");
      await expect(workProof.connect(client).acceptApplication(jobId, freelancer.address))
        .to.be.revertedWith("FREELANCER_BANNED");
    });
  });

  describe("deleteJob", () => {
    it("refunds the client and locks the job to Deleted", async () => {
      const { owner, client, workProof } = await deployFixture();
      const jobId = await postOpenJob(workProof, client);
      const balanceBefore = await ethers.provider.getBalance(client.address);

      await expect(workProof.connect(owner).deleteJob(jobId, "spam"))
        .to.emit(workProof, "JobDeleted");

      const job = await workProof.getJob(jobId);
      expect(job.status).to.equal(7);
      expect(job.escrowAmount).to.equal(0);
      expect(await workProof.totalEscrowed()).to.equal(0);
      const balanceAfter = await ethers.provider.getBalance(client.address);
      expect(balanceAfter - balanceBefore).to.equal(oneEth);
    });

    it("cannot delete a Completed job", async () => {
      const { owner, oracle, client, freelancer, workProof } = await deployFixture();
      const jobId = await postOpenJob(workProof, client);
      await workProof.connect(freelancer).applyForJob(jobId);
      await workProof.connect(client).acceptApplication(jobId, freelancer.address);
      await workProof.connect(freelancer).submitWork(jobId, "url");
      await workProof.connect(oracle).receiveVerdict(jobId, true, 100, "ok");
      await workProof.connect(freelancer).claimReward(jobId);
      await expect(workProof.connect(owner).deleteJob(jobId, "x")).to.be.revertedWith("TERMINAL");
    });
  });

  describe("overrideVerdict", () => {
    it("admin can override a Failed verdict to Passed and freelancer can claim", async () => {
      const { owner, oracle, client, freelancer, workProof } = await deployFixture();
      const jobId = await postOpenJob(workProof, client);
      await workProof.connect(freelancer).applyForJob(jobId);
      await workProof.connect(client).acceptApplication(jobId, freelancer.address);
      await workProof.connect(freelancer).submitWork(jobId, "url");
      await workProof.connect(oracle).receiveVerdict(jobId, false, 0, "nope");

      await expect(workProof.connect(owner).overrideVerdict(jobId, true, 100, "manual review"))
        .to.emit(workProof, "VerdictOverridden");

      const job = await workProof.getJob(jobId);
      expect(job.status).to.equal(4);
      await expect(workProof.connect(freelancer).claimReward(jobId)).to.emit(workProof, "RewardClaimed");
    });

    it("rejects override after claim", async () => {
      const { owner, oracle, client, freelancer, workProof } = await deployFixture();
      const jobId = await postOpenJob(workProof, client);
      await workProof.connect(freelancer).applyForJob(jobId);
      await workProof.connect(client).acceptApplication(jobId, freelancer.address);
      await workProof.connect(freelancer).submitWork(jobId, "url");
      await workProof.connect(oracle).receiveVerdict(jobId, true, 100, "ok");
      await workProof.connect(freelancer).claimReward(jobId);
      await expect(workProof.connect(owner).overrideVerdict(jobId, false, 0, "x")).to.be.revertedWith("ALREADY_CLAIMED");
    });
  });

  describe("setReputation", () => {
    it("admin can set rep points", async () => {
      const { owner, freelancer, workProof } = await deployFixture();
      await expect(workProof.connect(owner).setReputation(freelancer.address, 500, "manual grant"))
        .to.emit(workProof, "ReputationAdjusted");
      const profile = await workProof.getProfile(freelancer.address);
      expect(profile.reputationPoints).to.equal(500);
    });
  });

  describe("multi-oracle", () => {
    it("any registered oracle can call receiveVerdict", async () => {
      const { owner, oracle, other, client, freelancer, workProof } = await deployFixture();
      await workProof.connect(owner).addOracle(other.address);
      const jobId = await postOpenJob(workProof, client);
      await workProof.connect(freelancer).applyForJob(jobId);
      await workProof.connect(client).acceptApplication(jobId, freelancer.address);
      await workProof.connect(freelancer).submitWork(jobId, "url");

      await expect(workProof.connect(other).receiveVerdict(jobId, true, 100, "ok"))
        .to.emit(workProof, "VerdictReceived");
    });

    it("removed oracle is rejected", async () => {
      const { owner, oracle, client, freelancer, workProof } = await deployFixture();
      const jobId = await postOpenJob(workProof, client);
      await workProof.connect(freelancer).applyForJob(jobId);
      await workProof.connect(client).acceptApplication(jobId, freelancer.address);
      await workProof.connect(freelancer).submitWork(jobId, "url");
      await workProof.connect(owner).removeOracle(oracle.address);
      await expect(workProof.connect(oracle).receiveVerdict(jobId, true, 100, "x"))
        .to.be.revertedWith("ONLY_ORACLE");
    });
  });

  describe("disputeWindow", () => {
    it("blocks claim until window elapses then permits", async () => {
      const { owner, oracle, client, freelancer, workProof } = await deployFixture();
      await workProof.connect(owner).setDisputeWindow(3600);
      const jobId = await postOpenJob(workProof, client);
      await workProof.connect(freelancer).applyForJob(jobId);
      await workProof.connect(client).acceptApplication(jobId, freelancer.address);
      await workProof.connect(freelancer).submitWork(jobId, "url");
      await workProof.connect(oracle).receiveVerdict(jobId, true, 100, "ok");

      await expect(workProof.connect(freelancer).claimReward(jobId)).to.be.revertedWith("DISPUTE_WINDOW");

      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await expect(workProof.connect(freelancer).claimReward(jobId)).to.emit(workProof, "RewardClaimed");
    });

    it("cap is 7 days", async () => {
      const { owner, workProof } = await deployFixture();
      await expect(workProof.connect(owner).setDisputeWindow(7 * 24 * 3600 + 1)).to.be.revertedWith("WINDOW_TOO_LONG");
    });
  });

  describe("topUpEscrow", () => {
    it("anyone can top up an active job; reward + escrow + total tracked", async () => {
      const { client, freelancer, oracle, workProof } = await deployFixture();
      const jobId = await postOpenJob(workProof, client);
      await workProof.connect(freelancer).applyForJob(jobId);
      await workProof.connect(client).acceptApplication(jobId, freelancer.address);

      await expect(workProof.connect(client).topUpEscrow(jobId, { value: ethers.parseEther("0.5") }))
        .to.emit(workProof, "EscrowToppedUp");

      const job = await workProof.getJob(jobId);
      expect(job.escrowAmount).to.equal(ethers.parseEther("1.5"));
      expect(job.rewardAmount).to.equal(ethers.parseEther("1.5"));
      expect(await workProof.totalEscrowed()).to.equal(ethers.parseEther("1.5"));

      await workProof.connect(freelancer).submitWork(jobId, "url");
      await workProof.connect(oracle).receiveVerdict(jobId, true, 100, "ok");
      await expect(workProof.connect(freelancer).claimReward(jobId))
        .to.emit(workProof, "RewardClaimed")
        .withArgs(jobId, freelancer.address, ethers.parseEther("1.5"));
    });

    it("rejects topup on terminal status", async () => {
      const { owner, client, workProof } = await deployFixture();
      const jobId = await postOpenJob(workProof, client);
      await workProof.connect(owner).deleteJob(jobId, "x");
      await expect(workProof.connect(client).topUpEscrow(jobId, { value: 1n })).to.be.revertedWith("TOPUP_NOT_ALLOWED");
    });
  });

  describe("sweepStuckEth", () => {
    it("only sends balance above totalEscrowed", async () => {
      const { owner, client, treasury, workProof } = await deployFixture();
      await postOpenJob(workProof, client);

      // Send a stray transfer directly to the contract (not tied to a job)
      await client.sendTransaction({ to: await workProof.getAddress(), value: ethers.parseEther("0.3") });

      const beforeBal = await ethers.provider.getBalance(treasury.address);
      await expect(workProof.connect(owner).sweepStuckEth(treasury.address)).to.emit(workProof, "StuckEthSwept");
      const afterBal = await ethers.provider.getBalance(treasury.address);
      expect(afterBal - beforeBal).to.equal(ethers.parseEther("0.3"));

      // totalEscrowed and the job's escrow remain intact
      expect(await workProof.totalEscrowed()).to.equal(oneEth);
    });

    it("reverts when nothing is stuck", async () => {
      const { owner, client, treasury, workProof } = await deployFixture();
      await postOpenJob(workProof, client);
      await expect(workProof.connect(owner).sweepStuckEth(treasury.address)).to.be.revertedWith("NO_STUCK_ETH");
    });
  });
});
