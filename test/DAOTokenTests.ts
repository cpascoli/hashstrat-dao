import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("HashStratDAOToken", function () {

	async function deployTokenFixture() {
		const HashStratDAOToken = await ethers.getContractFactory("HashStratDAOToken");
		const hashStratDAOToken = await HashStratDAOToken.deploy()
		await hashStratDAOToken.deployed()

		return { hashStratDAOToken };
	}


	describe("HashStratDAOTokenFarm", function () {
		it("has symbol HST", async function () {
			const { hashStratDAOToken } = await loadFixture(deployTokenFixture);
	
			expect( await hashStratDAOToken.symbol() ).to.equal('HST');
		});

		it("has 18 decimals", async function () {
			const { hashStratDAOToken } = await loadFixture(deployTokenFixture);
	
			expect( await hashStratDAOToken.decimals() ).to.equal(18);
		});

		it("has total supply of 1000_000", async function () {
			const supply = ethers.utils.parseEther('1000000');   // 1M tokens
			const { hashStratDAOToken } = await loadFixture(deployTokenFixture);
	
			expect( ethers.utils.formatUnits (await hashStratDAOToken.totalSupply()) ).to.equal('1000000.0');
		});
	
	});

})