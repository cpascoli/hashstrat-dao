import { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers"


import abis from "./abis/abis.json";

const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'


const hashStratDAOTokenAddress = '0x77Ee22B63176DB8D904EF4aB5A4492BB700A8b39'
const hashStratDAOTokenFarmAddress = '0x08487dBb81Fcb2420b4C996f10E6B6DA9f37EB05'
const treasuryAddress = '0x645216B9Ae8e11bd3Fb997fA22753F1288094197'
const divsDistributorAdddress = '0x35c1D11D1A28Aa454386C9A13dFa7dA773caFA1F'


async function main() {

	await depolyHashStratDAOTokenAndFarm()
	await addLPTokensToFarm(hashStratDAOTokenFarmAddress)
	await deployDivDistributor(usdcAddress, hashStratDAOTokenAddress)
	await deployDAOOperations(usdcAddress, treasuryAddress, divsDistributorAdddress, hashStratDAOTokenFarmAddress)
}



const depolyHashStratDAOTokenAndFarm = async () => {

	///////  Deploy HashStratDAOToken 

	console.log("Starting deployment of HashStratDAOToken on POLYGON")
	const HashStratDAOToken = await ethers.getContractFactory("HashStratDAOToken");
	const hashStratDAOToken = await HashStratDAOToken.deploy()
	await hashStratDAOToken.deployed()

	console.log("HashStratDAOToken deployed at address:", hashStratDAOToken.address);

	/////// Deploy HashStratDAOTokenFarm

	console.log("Starting deployment of HashStratDAOTokenFarm: on POLYGON")
	const HashStratDAOTokenFarm = await ethers.getContractFactory("HashStratDAOTokenFarm");

  	const hashStratDAOTokenFarm = await HashStratDAOTokenFarm.deploy(hashStratDAOToken.address);
	await hashStratDAOTokenFarm.deployed();
	console.log("HashStratDAOTokenFarm deployed at address:", hashStratDAOTokenFarm.address);


	// Set farm address for HashStratDAOToken
	await hashStratDAOToken.setFarmAddress(hashStratDAOTokenFarm.address)

	// Add reward phases to Farm
	await hashStratDAOTokenFarm.addRewardPeriods()
	console.log("rewards periods created: ", (await hashStratDAOTokenFarm.rewardPeriodsCount()).toString() )


	return hashStratDAOTokenFarm.address
}



const deployDivDistributor = async (usdcAddress: string, hashStratDAOTokenAddress: string) => {

	///////  Deploy Governance :
	console.log("Starting deployment of Treasury on POLYGON")

	const Treasury = await ethers.getContractFactory("Treasury");
	const treasury = await Treasury.deploy(usdcAddress)
	await treasury.deployed()
	
	console.log("Treasury deployed at address ", treasury.address)
	console.log("Starting deployment of DivsDistributor on POLYGON")

	const DivsDistributor = await ethers.getContractFactory("DivsDistributor");
	const divsDistributor = await DivsDistributor.deploy(usdcAddress, hashStratDAOTokenAddress)
	await divsDistributor.deployed()

	console.log("DivsDistributor deployed at address ", divsDistributor.address)
	console.log("DivsDistributor distribution intervals: ", await divsDistributor.getDistributionIntervalsCount() )
}


const deployDAOOperations = async (usdcAddress: string, treasuryAddress: string, divsDistributorAdddress: string, tokenFarmAddress: string) => {

	// DAO Operations
	const DAOOperations = await ethers.getContractFactory("DAOOperations");
	const daoOperations = await DAOOperations.deploy(usdcAddress, treasuryAddress, divsDistributorAdddress, tokenFarmAddress)
	await daoOperations.deployed()

	// DAOOperations should own Treasury and hashStratDAOTokenFarm
	// await treasury.transferOwnership(daoOperations.address)
	// await hashStratDAOTokenFarm.transferOwnership(daoOperations.address)

	// Add existing Pools to DAOOperations 
	const poolAddresses = [pools.pool01v3a.pool, pools.pool02v3a.pool, pools.pool03v3a.pool, pools.pool04v3a.pool, pools.pool05v3a.pool, pools.pool06v3a.pool]
	await daoOperations.addPools(poolAddresses)


	//await transferPoolsOwnership(poolAddresses, daoOperations.address)

}



/// Helpers

const addLPTokensToFarm = async (farmAddress: string) => {

	const [ owner ] = await ethers.getSigners();

	const hashStratDAOTokenFarm = new Contract(farmAddress, abis['farm'], ethers.provider)
	const lpaddresses = getPoolLPTokenAddreses()
	console.log(">>> adding LP tokens to HashStratDAOTokenFarm: ", lpaddresses)

	await hashStratDAOTokenFarm.connect(owner).addLPTokens(lpaddresses)

	console.log(">>> added LP tokens to HashStratDAOTokenFarm: ", await hashStratDAOTokenFarm.getLPTokens())
}

const getPoolAddreses = () : string[] => {
	return Object.keys(pools).map(poolId => {
		const poolInfo = pools[poolId as keyof typeof pools ]
		return poolInfo["pool"] as string
	});
}

const getPoolLPTokenAddreses = () : string[] => {
	return Object.keys(pools).map(poolId => {
		const poolInfo = pools[poolId as keyof typeof pools ]
		return poolInfo["pool_lp"] as string
	});
}


/// ENTRY POINT

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});



// POOLS DATA

const pools = {

	"index01v3a": {
		"pool": "0xE61bA2eF1057dD90aAF9f021Fdf24F6B57D902AF",
		"pool_lp": "0x0560Dd521787e27126B93E98568002A3ef84E36c"
	},
	"index02v3a": {
		"pool": "0x1FB4fa664648a458c81A6fFDC7b3c7120CEb4E45",
		"pool_lp": "0x8A8dD5a0d50887D16303460ee00CB311D255b034"
	},
	"index03v3a": {
		"pool": "0xe0B5AfF7821bbABd48429D2B956A1202e3BA9b42",
		"pool_lp": "0x9D91628be9BA8B024644fF612d013956C7ADa928"
	},


	"pool01v3a": {
		"pool": "0x8714336322c091924495B08938E368Ec0d19Cc94",
		"pool_lp": "0x49c3ad1bF4BeFb024607059cb851Eb793c224BaB",
		"strategy": "0xbfB7A8caF44fD28188673B09aa3B2b00eF301118",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool02v3a": {
		"pool": "0xD963e4C6BE2dA88a1679A40139C5b75961cc2619",
		"pool_lp": "0xC27E560E3D1546edeC5DD858D404EbaF2166A763",
		"strategy": "0xc78BD1257b7fE3Eeb33fC824313C71D145C9754b",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool03v3a": {
		"pool": "0x63151e56140E09999983CcD8DD05927f9e8be81D",
		"pool_lp": "0xCdf8886cEea718ad37e02e9a421Eb674F20e5ba1",
		"strategy": "0x4687faf8e60ca8e532af3173C0225379939261F7",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool04v3a": {
		"pool": "0xd229428346E5Ba2F08AbAf52fE1d2C941ecB36AD",
		"pool_lp": "0xe4FF896D756Bdd6aa1208CDf05844335aEA56297",
		"strategy": "0xB98203780925694BAeAFDC7CB7C6ECb1E6631D17",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool05v3a": {
		"pool": "0xCfcF4807d10C564204DD131527Ba8fEb08e2cc9e",
		"pool_lp": "0x80bc0b435b7e7F0Dc3E95C3dEA87c68D5Ade4378",
		"strategy": "0xBbe4786c0D1cEda012B8EC1ad12a2F7a1A5941f1",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool06v3a": {
		"pool": "0xa2f3c0FDC55814E70Fdac2296d96bB04840bE132",
		"pool_lp": "0x2523c4Ab54f5466A8b8eEBCc57D8edC0601faB54",
		"strategy": "0x62386A92078CC4fEF921F9bb1f515464e2f7918f",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},


}



