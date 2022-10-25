import { expect } from "chai";
import { BigNumber, Contract } from "ethers"

import { ethers, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fromUsdc, toUsdc, round } from "./helpers"

import abis from "./abis/abis.json";

const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const usdcSource = '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245' // rich account owing 48,354,222.149244  USDC

const poolOwner = '0x4F888d90c31c97efA63f0Db088578BB6F9D1970C'


describe("Treasury", function () {


	async function deployTreasuryFixture() {

		// the existing usdc contract on the network
		const usdc = new Contract(usdcAddress, abis["erc20"], ethers.provider)

		const Treasury = await ethers.getContractFactory("Treasury");
		const treasury = await Treasury.deploy(usdc.address)
		await treasury.deployed()

		// DAO Operations
		const DAOOperations = await ethers.getContractFactory("DAOOperations");
		const daoOperations = await DAOOperations.deploy(usdcAddress, treasury.address, ethers.constants.AddressZero) // don't need to pass DivDistributoe address
		await daoOperations.deployed()

		// transfer Treasury ownership to DAOOperations
		await treasury.transferOwnership(daoOperations.address)
		
		// add pools to daoOperations
		await daoOperations.addPools([pools.pool01v3a.pool])		
		
		// add some funds to the pool
		// await transferFunds(1000 * 10 ** 6, pools.pool01v3a.pool)
				
		// impersonate 'poolOwner' and mint some LP tokens to the pool pool01v3a
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [poolOwner],
		});
		const signer = await ethers.getSigner(poolOwner);
		const lptoken = new Contract(pools.pool01v3a.pool_lp, abis["poolLP"], ethers.provider)
		await lptoken.connect(signer).mint(signer.address, 1000 * 10 ** 6)
		// await lptoken.connect(signer).mint(pools.pool01v3a.pool, 10 * 10 ** 6)

		// transfer pool01v3a ownership to DAOOperations
		const pool = new Contract(pools.pool01v3a.pool, abis["poolV3"], ethers.provider)
		await pool.connect(signer).transferOwnership(daoOperations.address)


		return { treasury, daoOperations, usdc };
	}



	// You can nest describe calls to create subsections.
	describe("#collectFees", function () {

		it("should receive fees", async function () {
			const { treasury, daoOperations } = await loadFixture(deployTreasuryFixture);
			const [ _, other ] = await ethers.getSigners();

			const [ poolAddr ] = await treasury.getPools()
			const pool = new Contract(poolAddr, abis["poolV3"], ethers.provider)

			const poolTotalValue = await pool.totalValue()
			const lptoken = new Contract(pool.lpToken(), abis["erc20"], ethers.provider)
			const poolLPBalance = await lptoken.balanceOf(pool.address)
			const lpTotalSupply = await lptoken.totalSupply()

			const balanceBefore = await treasury.getBalance()
			expect(balanceBefore).to.be.equal(0)

			// Collect fees from Pool into Treasury
			await daoOperations.connect(other).collectFees()

			// verify the Treasury received the expected fees
			const expectedFeesCollected = BigNumber.from(round( poolTotalValue * poolLPBalance / lpTotalSupply, 0))
			expect( fromUsdc(await treasury.getBalance()) ).to.be.approximately( fromUsdc(expectedFeesCollected), 0.01)
		});
	});


	describe("#collectableFees", function () {

		it("should have some fees", async function () {
			const { treasury, daoOperations } = await loadFixture(deployTreasuryFixture);

			const collectableFees = await treasury.collectableFees()
			console.log("collectableFees: ", collectableFees.toString() , fromUsdc(collectableFees) )

			await console.log("getBalance before: ",  fromUsdc(await treasury.getBalance()) )
			await daoOperations.collectFees()
			await console.log("getBalance after: ",  fromUsdc(await treasury.getBalance()) )

		});
	});

});



// Polygon Pools
const pools = {
	"pool01v3a": {
		"pool": "0x8714336322c091924495B08938E368Ec0d19Cc94",
		"pool_lp": "0x49c3ad1bF4BeFb024607059cb851Eb793c224BaB",
		"strategy": "0xbfB7A8caF44fD28188673B09aa3B2b00eF301118",
		"price_feed": "0x6135b13325bfC4B00278B4abC5e20bbce2D6580e"
	},

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