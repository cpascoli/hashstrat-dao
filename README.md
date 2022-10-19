# HashStrat Governance

This repo constains the Solidity smart contracts for HashStrat DAO. 
This includes:
- HashStrat DAO Token (HST)
- HashStrat DAO Token Farm 
- Governance contracts
- DAO Operations
- Fee farming 


## HashStrat DAO Token (HST)

The token of the HashStrat DAP. 
A standard ERC20 token, non mintable, with limited supply of 1M.



## HashStrat DAO Token Farm

Farming contract to distribute the entire supply of HST tokens to users of HashStrat Pools & Indexes.
Users who skake their PoolLP and IndexLP tokens into HashStratDAOTokenFarm will receive HST tokens as a rewards.
The distribution scheduele is fixes to 10 years.


## Install Dependencies

```shell
brew install node                # Install Node (MacOS with Homebrew)
npm install --save-dev hardhat   # Install HardHat
npm install                      # Install dependencies

```

##  Run Tests
```shell
npx hardhat test
```

##  Deployment 
```shell
npx hardhat run --network polygon scripts/deploy-polygon.ts
```
