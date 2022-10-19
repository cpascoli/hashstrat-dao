import { expect } from "chai";
import { ethers, network } from "hardhat";

import { constants, utils, Contract  } from "ethers"
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";


import abis from "./abis/abis.json";
import { fromUsdc, toUsdc, fromWei, toWei, mineBlocks } from "./helpers";

const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const usdcSource = '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245' // rich account owing 48,354,222.149244  USDC


describe("DAO", function () {

	async function deployGovernorFixture() {

		const HashStratDAOToken = await ethers.getContractFactory("HashStratDAOToken");
		const hashStratDAOToken = await HashStratDAOToken.deploy()
		await hashStratDAOToken.deployed()

		// Deploy TimelockController without any proposers. 
		// At deployment the deployer account receives an admin role that can be used to add a proposer later (see the TimelockController Roles docs section).
		// A common use case is to position TimelockController as the owner of a smart contract, with a DAO (Governor) as the sole proposer.
		const TimelockController = await ethers.getContractFactory("HashStratTimelockController");
		const timelockDelay = 0
		const timelockController = await TimelockController.deploy(timelockDelay)
		await timelockController.deployed()

		const TIMELOCK_ADMIN_ROLE = await timelockController.TIMELOCK_ADMIN_ROLE()
		const PROPOSER_ROLE = await timelockController.PROPOSER_ROLE()
		const EXECUTOR_ROLE = await timelockController.EXECUTOR_ROLE()

		// Deploy Governor with GovernorTimelockControl, connected to the timelock that was just deployed.
		const initialVotingDelay = 0
		const initialVotingPeriod = 1000
		const initialProposalThreshold = 0

		const HashStratGovernor = await ethers.getContractFactory("HashStratGovernor");
		const hashStratGovernor = await HashStratGovernor.deploy(hashStratDAOToken.address, timelockController.address, initialVotingDelay, initialVotingPeriod, initialProposalThreshold)
		await hashStratGovernor.deployed()

		// Add the Governor as a proposer and executor roles 
		//TODO renounce the timelock admin role from the deployer account.
		await timelockController.grantRole(EXECUTOR_ROLE, hashStratGovernor.address)
		await timelockController.grantRole(PROPOSER_ROLE, hashStratGovernor.address)

		// the existing usdc contract on the network
		const usdc = new Contract(usdcAddress, abis["erc20"], ethers.provider)

		// DAO Operations
		const DAOOperations = await ethers.getContractFactory("DAOOperations");
		const daoOperations = await DAOOperations.deploy(usdc.address)
		await daoOperations.deployed()

		const poolAddresses = [pools.pool01.pool, pools.pool02.pool, pools.pool03.pool, pools.pool04.pool, pools.pool05.pool, pools.pool06.pool]
		await daoOperations.addPools(poolAddresses)

		// HashStratTimelockController must own DAOOperations to execute DAOOperations onlyOwner functions
		await daoOperations.transferOwnership(timelockController.address) 


		return { hashStratDAOToken, timelockController, hashStratGovernor, daoOperations, usdc, timelockDelay };
	}


	describe("Governor", function () {

		it("has Proposer role", async function () {
			const { timelockController, hashStratGovernor } = await loadFixture(deployGovernorFixture);
			const PROPOSER_ROLE = await timelockController.PROPOSER_ROLE()

			expect( await timelockController.hasRole(PROPOSER_ROLE, hashStratGovernor.address) ).to.be.true
		});

		it("has Executor role", async function () {
			const { timelockController, hashStratGovernor } = await loadFixture(deployGovernorFixture);
			const EXECUTOR_ROLE = await timelockController.EXECUTOR_ROLE()

			expect( await timelockController.hasRole(EXECUTOR_ROLE, hashStratGovernor.address) ).to.be.true
		});
	});


	describe("Proposals", function () {

		it("creates a new proposal", async function () {

			const [ proposer, recepient ] = await ethers.getSigners();
			const { hashStratGovernor, daoOperations, usdc } = await loadFixture(deployGovernorFixture);

			// Submit proposal
			const transferCalldata = usdc.interface.encodeFunctionData('transfer', [recepient.address, 1000 * 10 ** 6]);
			await hashStratGovernor.connect(proposer)["propose(address[],uint256[],bytes[],string)"] (
				[daoOperations.address],
				[0],
				[transferCalldata],
				"Proposal #1: Transfer USDC to address"
			);

			// get proposal state by proposalId
			const proposalId = await hashStratGovernor.hashProposal(
				[daoOperations.address],
				[0],
				[transferCalldata],
				ethers.utils.id("Proposal #1: Transfer USDC to address")  // hash of the proposal description
			)
			const proposalState = await hashStratGovernor.state(proposalId)

			const Pending = 0
			expect( proposalState ).to.be.equal(Pending)
		});


		it("votes on a proposal", async function () {

			const [ proposer, voter, recepient ] = await ethers.getSigners();
			const { hashStratGovernor, hashStratDAOToken, daoOperations, usdc } = await loadFixture(deployGovernorFixture);

			hashStratDAOToken.connect(voter).delegate(voter.address)

			// transfer  tokens to voter
			await hashStratDAOToken.transfer(voter.address, toWei('100000') )
			
			// Submit proposal
			const transferCalldata = usdc.interface.encodeFunctionData('transfer', [recepient.address, 1000 * 10 ** 6]);
			await hashStratGovernor.connect(proposer)["propose(address[],uint256[],bytes[],string)"] (
				[daoOperations.address],
				[0],
				[transferCalldata],
				"Proposal #1: Transfer USDC to address"
			);

			// get proposal state by proposalId
			const proposalId = await hashStratGovernor.hashProposal(
				[daoOperations.address],
				[0],
				[transferCalldata],
				ethers.utils.id("Proposal #1: Transfer USDC to address")  // hash of the proposal description
			)

			/// Vote for the proposal (Against: 0, For: 1, Abstain: 2)
			await hashStratGovernor.connect(voter).castVote(proposalId, 1)
			await mineBlocks(1000) // wait for the end of the proposal period

			// verify the proposal has succeeded
			const proposalState = await hashStratGovernor.state(proposalId)
			const Succeeded = 4
			expect( proposalState ).to.be.equal(Succeeded)
		});


		it("executes a succesful proposal", async function () {

			const [ proposer, voter, recepient ] = await ethers.getSigners();
			const { hashStratGovernor, hashStratDAOToken, daoOperations, usdc, timelockDelay } = await loadFixture(deployGovernorFixture);

			hashStratDAOToken.connect(voter).delegate(voter.address)

			// transfer  tokens to voter
			await hashStratDAOToken.transfer(voter.address, toWei('100000') )
			
			// transfer USDC to daoOperations
			const feesAmount = 1000 * 10 ** 6
			await transferFunds( feesAmount, daoOperations.address )

			// Submit proposal to transfer 1000 USDC from 'daoOperations' to 'recepient'
			const description = "Proposal #1: Transfer USDC to recipient address"
			const transferCalldata = daoOperations.interface.encodeFunctionData('transferFees', [recepient.address, feesAmount]);
			await hashStratGovernor.connect(proposer)["propose(address[],uint256[],bytes[],string)"] (
				[daoOperations.address],
				[0],
				[transferCalldata],
				description
			);

			// get proposal state by proposalId
			const proposalId = await hashStratGovernor.hashProposal(
				[daoOperations.address],
				[0],
				[transferCalldata],
				ethers.utils.id(description)
			)

			/// Cast vote on proposal (Against: 0, For: 1, Abstain: 2)
			await hashStratGovernor.connect(voter).castVote(proposalId, 1)

			await mineBlocks(1000) // wait for the end of the proposal period
			const proposalState = await hashStratGovernor.state(proposalId)

			const Succeeded = 4
			expect( proposalState ).to.be.equal(Succeeded)

			const recipientBalanceBefore = await usdc.balanceOf(recepient.address)

			// queue proposal for execution
			await hashStratGovernor["queue(address[],uint256[],bytes[],bytes32)"](
				[daoOperations.address],
				[0],
				[transferCalldata],
				ethers.utils.id(description)
			);

			// execute proposal 
			await hashStratGovernor["execute(address[],uint256[],bytes[],bytes32)"](
				[daoOperations.address],
				[0],
				[transferCalldata],
				ethers.utils.id(description)
			);

			// verify fees have been transferred to recipient
			const recipientBalanceAfter = await usdc.balanceOf(recepient.address)
			expect( recipientBalanceAfter ).to.be.equal( recipientBalanceBefore.add(feesAmount) )
		});


	});
	

})


async function transferFunds(amount: number | string, recipient: string) {

	const usdc = new Contract(usdcAddress, abis["erc20"], ethers.provider)

	// impersonate 'account'
	await network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [usdcSource],
	});
	const signer = await ethers.getSigner(usdcSource);
	await usdc.connect(signer).transfer(recipient, amount)
}



// Polygon Pools
const pools = {

	"pool01": {
		"pool": "0x7b8b3fc7563689546217cFa1cfCEC2541077170f",
		"pool_lp": "0x2EbF538B3E0F556621cc33AB5799b8eF089b2D8C",
		"strategy": "0x6aa3D1CB02a20cff58B402852FD5e8666f9AD4bd",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool02": {
		"pool": "0x62464FfFAe0120E662169922730d4e96b7A59700",
		"pool_lp": "0x26b80F5970bC835751e2Aabf4e9Bc5B873713f17",
		"strategy": "0xca5B24b63D929Ddd5856866BdCec17cf13bDB359",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool03": {
		"pool": "0xc60CE76892138d9E0cE722eB552C5d8DE70375a5",
		"pool_lp": "0xe62A17b61e4E309c491F1BD26bA7BfE9e463610e",
		"strategy": "0x46cfDDc7ab8348b44b4a0447F0e5077188c4ff14",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool04": {
		"pool": "0x82314313829B7AF502f9D60a4f215F6b6aFbBE4B",
		"pool_lp": "0xA9085698662029Ef6C21Bbb23a81d3eB55898926",
		"strategy": "0x02CF4916Dd9f4bB329AbE5e043569E586fE006E4",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool05": {
		"pool": "0x742953942d6A3B005e28a451a0D613337D7767b2",
		"pool_lp": "0x7EB471C4033dd8c25881e9c02ddCE0C382AE8Adb",
		"strategy": "0x7F7a40fa461931f3aecD183f8B56b2782483B04B",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool06": {
		"pool": "0x949e118A42D15Aa09d9875AcD22B87BB0E92EB40",
		"pool_lp": "0x74243293f6642294d3cc94a9C633Ae943d557Cd3",
		"strategy": "0x26311040c72f08EF1440B784117eb96EA20A2412",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	
}