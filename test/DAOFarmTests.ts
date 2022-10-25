import { expect } from "chai";
import { Contract, BigNumber } from "ethers"
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fromWei, waitDays } from "./helpers"

import abis from "./abis/abis.json";


const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const usdcSource = '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245' // rich account owing 48,354,222.149244  USDC


describe("HashStratDAOTokenFarm", function () {

	const max_supply = ethers.utils.parseEther('1000000.0');   // 1M tokens

	async function deployTokenAndFarm() {

		const HashStratDAOToken = await ethers.getContractFactory("HashStratDAOToken")
		const HashStratDAOTokenFarm = await ethers.getContractFactory("HashStratDAOTokenFarm")

		// Deploy HST token
		const hashStratDAOToken = await HashStratDAOToken.deploy()
		await hashStratDAOToken.deployed()

		// Deploy Farm
		const hashStratDAOTokenFarm = await HashStratDAOTokenFarm.deploy(hashStratDAOToken.address)
		await hashStratDAOTokenFarm.deployed();

		// Set farm address on DAO token
		await hashStratDAOToken.setFarmAddress(hashStratDAOTokenFarm.address)

		// add supported LP tokens to Farm
		await addLPTokens(hashStratDAOTokenFarm)

		// add reward phases to Farm
		await hashStratDAOTokenFarm.addRewardPeriods()

		const usdc = new Contract(usdcAddress, abis["erc20"], ethers.provider)
		const pool1 = new Contract(pools.pool01v3.pool, abis["poolV3"], ethers.provider)
		const pool1LP = new Contract(pools.pool01v3.pool_lp, abis["erc20"], ethers.provider)

		return { hashStratDAOToken, hashStratDAOTokenFarm, usdc, pool1, pool1LP };
	}



	// You can nest describe calls to create subsections.
	describe("HashStratDAOTokenFarm", function () {

		it("Farm should have 6 LP tokens addresses", async function () {
			const { hashStratDAOTokenFarm } = await loadFixture(deployTokenAndFarm);

			expect((await hashStratDAOTokenFarm.getLPTokens()).length).to.equal(6);
		});


		it("Farm should have 10 reward periods", async function () {
			const { hashStratDAOTokenFarm } = await loadFixture(deployTokenAndFarm);

			expect(await hashStratDAOTokenFarm.rewardPeriodsCount()).to.equal(10);
			
		});

		it("The total amount of tokens distributed should be the token max supply", async function () {
			const { hashStratDAOTokenFarm, hashStratDAOToken } = await loadFixture(deployTokenAndFarm);

			const maxSupply = await hashStratDAOToken.MAX_SUPPLY()

			let totalReward = BigNumber.from(0)
			for (const period of await hashStratDAOTokenFarm.getRewardPeriods() ) {
				totalReward = totalReward.add(period.reward)
			}

			expect(totalReward).to.equal(maxSupply);
		});


		it(`Given One user,
		when they stake some tokens for the entire reward period, 
		then they should farm all tokens in that period`, async function () {

			const [addr1] = await ethers.getSigners();
			const { usdc, hashStratDAOTokenFarm, hashStratDAOToken, pool1, pool1LP } = await loadFixture(deployTokenAndFarm);
			const amount = 100 * 10 ** 6
			await transferFunds(amount, addr1.address)

			// Deposit USDC in pool and stake LP
			const lpstaked = await depositAndStake(addr1, amount, usdc, pool1, pool1LP, hashStratDAOTokenFarm)

			expect(lpstaked).to.be.equal(await hashStratDAOTokenFarm.getStakedLP(addr1.address))

			// Wait 1 year
			await waitDays(365)

			// claimable tokens after 1 year
			const claimableRewardAddr1 = fromWei(await hashStratDAOTokenFarm.claimableReward(addr1.address))
			expect(claimableRewardAddr1).to.be.approximately(500_000, 1);

			await hashStratDAOTokenFarm.connect(addr1).endStakeAndWithdraw(pool1LP.address, lpstaked)
			const tokensFarmed = fromWei(await hashStratDAOToken.balanceOf(addr1.address))

			expect(tokensFarmed).to.be.approximately(500_000, 1);
		})


		it(`Given One user,
		when they stake some tokens for all reward periods, 
		then they should farm the token max supply`, async function () {

			const [addr1] = await ethers.getSigners();
			const { usdc, hashStratDAOTokenFarm, hashStratDAOToken, pool1, pool1LP } = await loadFixture(deployTokenAndFarm);
			const amount = 100 * 10 ** 6
			await transferFunds(amount, addr1.address)

			// Deposit USDC in pool and stake LP
			const lpstaked = await depositAndStake(addr1, amount, usdc, pool1, pool1LP, hashStratDAOTokenFarm)

			expect(lpstaked).to.be.equal(await hashStratDAOTokenFarm.getStakedLP(addr1.address))

			// Wait 10 years
			await waitDays(10 * 365)

			// claimable tokens after 1 year
			const claimableRewardAddr1 = fromWei(await hashStratDAOTokenFarm.claimableReward(addr1.address))
			expect(claimableRewardAddr1).to.be.approximately(1_000_000, 200);

			await hashStratDAOTokenFarm.connect(addr1).endStakeAndWithdraw(pool1LP.address, lpstaked)
			const tokensFarmed = fromWei(await hashStratDAOToken.balanceOf(addr1.address))

			expect(tokensFarmed).to.be.approximately(1_000_000, 200);
		})



		it(`Given Two users,
		when they stake the same amount for the entire reward period, 
		then they should receive half of the available reward in the period`, async function () {

			const [addr1, addr2] = await ethers.getSigners();
			const { usdc, hashStratDAOTokenFarm, hashStratDAOToken, pool1, pool1LP } = await loadFixture(deployTokenAndFarm);

			const amount = 100 * 10 ** 6
			await transferFunds(amount, addr1.address)
			await transferFunds(amount, addr2.address)

			// addr1, addr2 deposit and stake the same amount of USDC
			const lpstaked1 = await depositAndStake(addr1, amount, usdc, pool1, pool1LP, hashStratDAOTokenFarm)
			const lpstaked2 = await depositAndStake(addr2, amount, usdc, pool1, pool1LP, hashStratDAOTokenFarm)

			// Wait 12 month
			await waitDays(365)

			// claimable tokens after 12 month2
			const claimableRewardAddr1 = fromWei(await hashStratDAOTokenFarm.claimableReward(addr1.address))
			const claimableRewardAddr2 = fromWei(await hashStratDAOTokenFarm.claimableReward(addr2.address))

			expect(claimableRewardAddr1).to.be.approximately(250_000, 150);
			expect(claimableRewardAddr2).to.be.approximately(250_000, 150);

			// addr1, addr2 end stake
			await hashStratDAOTokenFarm.connect(addr1).endStakeAndWithdraw(pool1LP.address, lpstaked1)
			await hashStratDAOTokenFarm.connect(addr2).endStakeAndWithdraw(pool1LP.address, lpstaked2)

			const tokensFarmed1 = fromWei(await hashStratDAOToken.balanceOf(addr1.address))
			const tokensFarmed2 = fromWei(await hashStratDAOToken.balanceOf(addr2.address))

			// users should have farmed approximately the same amount of tokens
			expect(tokensFarmed1).to.be.approximately(tokensFarmed2, 300);

			// users should have farmed approximately half od the available tokens
			expect(tokensFarmed1).to.be.approximately(250_000, 150);
			expect(tokensFarmed2).to.be.approximately(250_000, 150);

		});


		it(`Given Two users, 
		when they stake some amount for half of the reward period, 
		then they should receive half of the available reward in the period`, async function () {

			const [addr1, addr2] = await ethers.getSigners();
			const { usdc, hashStratDAOTokenFarm, hashStratDAOToken, pool1, pool1LP } = await loadFixture(deployTokenAndFarm);

			const amount1 = 100 * 10 ** 6
			const amount2 = 50 * 10 ** 6
			await transferFunds(amount1, addr1.address)
			await transferFunds(amount2, addr2.address)

			// addr1 deposit and stake
			const lpstaked1 = await depositAndStake(addr1, amount1, usdc, pool1, pool1LP, hashStratDAOTokenFarm)

			// Wait 6 months
			await waitDays(365 / 2)

			// addr1 claimable tokens after 6 months stake
			const claimableRewardAddr1 = fromWei(await hashStratDAOTokenFarm.claimableReward(addr1.address))
			expect(claimableRewardAddr1).to.be.approximately(250_000, 2);

			// addr1 end stake and withdraw
			await hashStratDAOTokenFarm.connect(addr1).endStakeAndWithdraw(pool1LP.address, lpstaked1)

			// addr2 deposit and stake
			const lpstaked2 = await depositAndStake(addr2, amount2, usdc, pool1, pool1LP, hashStratDAOTokenFarm)

			// Wait other 6 months
			await waitDays(365 / 2)

			// addr2 claimable tokens after 6 months stake
			const claimableRewardAddr2 = fromWei(await hashStratDAOTokenFarm.claimableReward(addr2.address))
			expect(claimableRewardAddr2).to.be.approximately(250_000, 2);

			// addr2 end stake and withdraw
			await hashStratDAOTokenFarm.connect(addr2).endStakeAndWithdraw(pool1LP.address, lpstaked2)

			// verify amount of tokens farmed
			const tokensFarmed1 = fromWei(await hashStratDAOToken.balanceOf(addr1.address))
			const tokensFarmed2 = fromWei(await hashStratDAOToken.balanceOf(addr2.address))

			// users should have farmed approximately the same amount of tokens
			expect(tokensFarmed1).to.be.approximately(tokensFarmed2, 5);

			// users should have farmed approximately half od the available tokens
			expect(tokensFarmed1).to.be.approximately(250_000, 2);
			expect(tokensFarmed2).to.be.approximately(250_000, 2);

		});



		it(`Given Two users, 
		when they stake some LP tokens for different, overlapping intervals over the same reward period, 
		then they should receive a reward that is proportional to the amount of tokens staked and the duration of their stakes`, async function () {

			const [addr1, addr2] = await ethers.getSigners();
			const { usdc, hashStratDAOTokenFarm, hashStratDAOToken, pool1, pool1LP } = await loadFixture(deployTokenAndFarm);

			const amount1 = 100 * 10 ** 6
			const amount2 = 50 * 10 ** 6
			await transferFunds(amount1, addr1.address)
			await transferFunds(amount2, addr2.address)

			// addr1 deposit and stake
			const lpstaked1 = await depositAndStake(addr1, amount1, usdc, pool1, pool1LP, hashStratDAOTokenFarm)

			// Wait 3 months
			await waitDays(365 * 1 / 4)

			// addr1 claimable tokens after 3 months stake shoud be 1/4 of the overall reward for the year
			const claimableRewardAddr1 = fromWei(await hashStratDAOTokenFarm.claimableReward(addr1.address))
			expect(claimableRewardAddr1).to.be.approximately(500_000 / 4, 2);

			// addr2 deposit and stake
			const lpstaked2 = await depositAndStake(addr2, amount2, usdc, pool1, pool1LP, hashStratDAOTokenFarm)

			// Wait other 9 months
			await waitDays(365 * 3 / 4)

			// addr1, addr2 end stake and withdraw
			await hashStratDAOTokenFarm.connect(addr1).endStakeAndWithdraw(pool1LP.address, lpstaked1)
			await hashStratDAOTokenFarm.connect(addr2).endStakeAndWithdraw(pool1LP.address, lpstaked2)


			// verify amount of tokens farmed
			const tokensFarmed1 = fromWei(await hashStratDAOToken.balanceOf(addr1.address))
			const tokensFarmed2 = fromWei(await hashStratDAOToken.balanceOf(addr2.address))

			// users should have farmed an aout of token proportional to the amount and period of their stakes
			const expectedFarmed1 = (500_000 * 1 / 4) + (500_000 * 3 / 4 * 2 / 3)
			const expectedFarmed2 = 0 + (500_000 * 3 / 4 * 1 / 3)


			// users should have farmed approximately half od the available tokens
			expect(tokensFarmed1).to.be.approximately(expectedFarmed1, 100);
			expect(tokensFarmed2).to.be.approximately(expectedFarmed2, 100);

		});


		it(`Given Two users,
		when they stake some LP tokens for different, overlapping intervals over multiple reward periods,
		then they should receive a reward that is proportional to the amount of tokens staked and the duration of their stakes`, async function () {

			const [addr1, addr2] = await ethers.getSigners();
			const { usdc, hashStratDAOTokenFarm, hashStratDAOToken, pool1, pool1LP } = await loadFixture(deployTokenAndFarm);

			const amount1 = 100 * 10 ** 6
			const amount2 = 50 * 10 ** 6
			await transferFunds(amount1, addr1.address)
			await transferFunds(amount2, addr2.address)

			// Wait 3 months
			await waitDays(365 * 1 / 4)

			// addr1 deposit and stake
			const lpstaked1 = await depositAndStake(addr1, amount1, usdc, pool1, pool1LP, hashStratDAOTokenFarm)

			// Wait 1y and 3m (to 1y and 6m)
			await waitDays(365 + 365 / 4)

			// addr1 claimable tokens after 1y and 3m staking should be 3/4 of the reward for year 1 and 1/2 of the reward for year 2
			const claimableRewardAddr1 = fromWei(await hashStratDAOTokenFarm.claimableReward(addr1.address))
			expect(claimableRewardAddr1).to.be.approximately(500_000 * 3 / 4 + 250_000 / 2, 2);

			// addr2 deposit and stake (after 1y and 6m)
			const lpstaked2 = await depositAndStake(addr2, amount2, usdc, pool1, pool1LP, hashStratDAOTokenFarm)

			// Wait 9 months (to 2y and 3m)
			await waitDays(365 * 3 / 4)

			// addr1, addr2 end stake and withdraw
			await hashStratDAOTokenFarm.connect(addr1).endStakeAndWithdraw(pool1LP.address, lpstaked1)

			// Wait 9 months (to end of 3y)
			await waitDays(365 * 3 / 4)
			await hashStratDAOTokenFarm.connect(addr2).endStakeAndWithdraw(pool1LP.address, lpstaked2)

			// get the amount of tokens farmed
			const tokensFarmed1 = fromWei(await hashStratDAOToken.balanceOf(addr1.address))
			const tokensFarmed2 = fromWei(await hashStratDAOToken.balanceOf(addr2.address))

			// addr1,addr2 should have farmed an amount of token proportional to the amount and period of their stakes
			const expectedFarmed1 = (500_000 * 3 / 4) + (250_000 * 1 / 2) + (250_000 * 1 / 2 * 2 / 3) + (125_000 * 1 / 4 * 2 / 3)
			const expectedFarmed2 = 0 + 0 + (250_000 * 1 / 2 * 1 / 3) + (125_000 * 1 / 4 * 1 / 3) + (125_000 * 3 / 4)


			// users should have farmed approximately half od the available tokens
			expect(tokensFarmed1).to.be.approximately(expectedFarmed1, 150);
			expect(tokensFarmed2).to.be.approximately(expectedFarmed2, 150);

		});


		it(`Given Two users,
		when they stake some LP tokens for different, non overlapping intervals over different reward periods,
		then they should receive a reward that is proportional the duration of their stakes`, async function () {

			const [addr1, addr2] = await ethers.getSigners();
			const { usdc, hashStratDAOTokenFarm, hashStratDAOToken, pool1, pool1LP } = await loadFixture(deployTokenAndFarm);

			const amount1 = 100 * 10 ** 6
			const amount2 = 50 * 10 ** 6
			await transferFunds(2 * amount1, addr1.address)
			await transferFunds(2 * amount2, addr2.address)

			// Wait 3 months (to 1y 3m)
			await waitDays(365 * 1 / 4)

			// addr1 deposit and stake for 6m (to 1y 9m)
			const lpstaked1 = await depositAndStake(addr1, amount1, usdc, pool1, pool1LP, hashStratDAOTokenFarm)
			await waitDays(365 / 2)
			await endStakeAndWithdraw(addr1, lpstaked1, pool1, pool1LP, hashStratDAOTokenFarm)

			// Wait 3 months (to 2y 0m)
			await waitDays(365 * 1 / 4)

			// addr2 deposit and stake for 9m (to 2y 9m)
			const lpstaked2 = await depositAndStake(addr2, amount2, usdc, pool1, pool1LP, hashStratDAOTokenFarm)
			await waitDays(365 * 3 / 4)
			await endStakeAndWithdraw(addr2, lpstaked2, pool1, pool1LP, hashStratDAOTokenFarm)

			// Wait 3 months (to 3y 0m)
			await waitDays(365 * 1 / 4)

			// addr2 stakes for 3 months (to 3y 3m)
			await depositAndStake(addr2, amount2, usdc, pool1, pool1LP, hashStratDAOTokenFarm)
			await waitDays(365 * 1 / 4)
			await endStakeAndWithdraw(addr2, lpstaked2, pool1, pool1LP, hashStratDAOTokenFarm)

			// Wait 3 months (to 3y 6m)
			await waitDays(365 * 1 / 4)

			// addr1 stakes for 6m (to end of 3y)
			await depositAndStake(addr1, amount1, usdc, pool1, pool1LP, hashStratDAOTokenFarm)
			await waitDays(365 / 2)
			await endStakeAndWithdraw(addr1, lpstaked1, pool1, pool1LP, hashStratDAOTokenFarm)


			// get the amount of tokens farmed
			const tokensFarmed1 = fromWei(await hashStratDAOToken.balanceOf(addr1.address))
			const tokensFarmed2 = fromWei(await hashStratDAOToken.balanceOf(addr2.address))

			// addr1,addr2 should have farmed an amount of token proportional to the amount and period of their stakes
			const expectedFarmed1 = (500_000 * 1 / 2) + 0 + (125_000 * 1 / 2)
			const expectedFarmed2 = 0 + (250_000 * 3 / 4) + (125_000 * 1 / 4)


			// users should have farmed approximately half od the available tokens
			expect(tokensFarmed1).to.be.approximately(expectedFarmed1, 150);
			expect(tokensFarmed2).to.be.approximately(expectedFarmed2, 150);
		});

	});

});


async function depositAndStake(addr: SignerWithAddress, amount: number, usdc: Contract, pool: Contract, poolLP: Contract, hashStratDAOTokenFarm: Contract) {
	await usdc.connect(addr).approve(pool.address, amount)
	await pool.connect(addr).deposit(amount)

	// Stake LP 
	const lpbalance = await poolLP.balanceOf(addr.address)
	await poolLP.connect(addr).approve(hashStratDAOTokenFarm.address, lpbalance)
	await hashStratDAOTokenFarm.connect(addr).depositAndStartStake(poolLP.address, lpbalance)

	return lpbalance
}


async function endStakeAndWithdraw(addr: SignerWithAddress, amount: number, pool: Contract, poolLP: Contract, hashStratDAOTokenFarm: Contract) {

	// end stake and get back farmed tokens and LP tokens 
	await hashStratDAOTokenFarm.connect(addr).endStakeAndWithdraw(poolLP.address, amount)
	await pool.connect(addr).withdrawAll()
}


async function transferFunds(amount: number, recipient: string) {

	// 48,354,222.149244   100.000000
	const [owner, addr1, addr2] = await ethers.getSigners();
	const usdc = new Contract(usdcAddress, abis["erc20"], ethers.provider)

	// impersonate 'account'
	await network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [usdcSource],
	});
	const signer = await ethers.getSigner(usdcSource);
	await usdc.connect(signer).transfer(recipient, amount)
}


const addLPTokens = async (hashStratDAOTokenFarm: Contract) => {
	for (const lpaddress of getPoolLPTokenAddreses()) {
		// console.log(">>> adding LP Address to hashStratDAOTokenFarm: ", lpaddress)
		await hashStratDAOTokenFarm.addLPToken(lpaddress)
	}
}


const getPoolLPTokenAddreses = (): string[] => {
	return Object.keys(pools).map(poolId => {
		const poolInfo = pools[poolId as keyof typeof pools]
		return poolInfo["pool_lp"] as string
	});
}



// Polygon Pools
const pools = {
	"pool01v3": {
		"pool": "0xb7BB83e1c826a8945652434DCf1758B46d6A5120",
		"pool_lp": "0xF87c6838EAD55f40B7d3038FBbb1287767898EeB",
		"strategy": "0x6aa3D1CB02a20cff58B402852FD5e8666f9AD4bd",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool02v3": {
		"pool": "0x12a2aeFfc32e2e2151600693812738eDc7153B2A",
		"pool_lp": "0x326A17829A9DCA987ae14448Dec7148552f05C22",
		"strategy": "0xca5B24b63D929Ddd5856866BdCec17cf13bDB359",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool03v3": {
		"pool": "0xdE2965dFE6a87fD303E252f44678A7580b4580Da",
		"pool_lp": "0x1cdD5238d95d06b252dfF2F5b27566f2103291B0",
		"strategy": "0x46cfDDc7ab8348b44b4a0447F0e5077188c4ff14",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool04v3": {
		"pool": "0x45E850A7E3ba7f67196EC1e19aFBEe1Ed0f3E875",
		"pool_lp": "0x1d8F6DaA2e438BAB778E47f2B5d4aa4C545e0822",
		"strategy": "0x02CF4916Dd9f4bB329AbE5e043569E586fE006E4",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool05v3": {
		"pool": "0xdB1fc68059ca310E51F5Ba6BdD567b08858eb29D",
		"pool_lp": "0xD95Bd1BD362298624471C15bb959A9E4e883F670",
		"strategy": "0x7F7a40fa461931f3aecD183f8B56b2782483B04B",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool06v3": {
		"pool": "0x32B4A2F744Ab50e80ffa3E48CF4Caaadd37d7215",
		"pool_lp": "0xEE41Db28d1224807358e11155bA7Df9d9cEC90F2",
		"strategy": "0x26311040c72f08EF1440B784117eb96EA20A2412",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
}


async function setupPool(pool: Contract) {

	const users = await pool.getUsers()

	for (const user of users) {

		const balance = await pool.portfolioValue(user)
		if (balance > 0) {
			console.log(" user ", user, "balance: ", balance.toString())

			await network.provider.request({
				method: "hardhat_impersonateAccount",
				params: [user],
			});

			const signer = await ethers.getSigner(user);
			await pool.connect(signer).withdrawAll()

			const balanceAfter = await pool.portfolioValue(user)
			console.log(" setupPool ", balance.toString(), balanceAfter.toString())
		}

	}


}