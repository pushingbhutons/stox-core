const utils = require('./helpers/utils');
const web3utils = require('web3-utils');

const NewWalletImpl = artifacts.require("./wallets/V1/WalletImpl.sol");
const NewWalletImpl2 = artifacts.require("./wallets/V2/WalletImplV2.sol");
const UpgradableSmartWallet = artifacts.require("./wallets/upgradable/UpgradableSmartWallet.sol");
const INewWalletImpl = artifacts.require("./wallets/V1/IWalletImpl.sol");
const INewWalletImpl2 = artifacts.require("./wallets/V2/IWalletImplV2.sol");
const RelayDispatcher = artifacts.require("./wallets/upgradable/RelayDispatcher.sol");
const ExtendedERC20Token = artifacts.require("./token/ExtendedERC20Token.sol");
const PoolPrediction = artifacts.require("./predictions/types/pool/PoolPrediction.sol");
const UpgradablePredictionFactory = artifacts.require("./predictions/factory/UpgradablePredictionFactory.sol");
const PoolPredictionFactoryImpl = artifacts.require("./predictions/factory/PoolPredictionFactoryImpl.sol");
const IPoolPredictionFactoryImpl = artifacts.require("./predictions/factory/IPoolPredictionFactoryImpl.sol");
const UpgradableOracleFactory = artifacts.require("./oracles/factory/UpgradableOracleFactory.sol");
const IUpgradableOracleFactoryImpl = artifacts.require("./oracles/factory/IUpgradableOracleFactoryImpl.sol");
const OracleFactoryImpl = artifacts.require("./oracles/factory/OracleFactoryImpl.sol");
const MultipleOutcomeOracle = artifacts.require("./oracles/types/MultipleOutcomeOracle.sol");
const ScalarPrediction = artifacts.require("./predictions/types/scalar/ScalarPrediction.sol");
const IScalarPredictionFactoryImpl = artifacts.require("./predictions/factory/IScalarPredictionFactoryImpl.sol");
const ScalarPredictionFactoryImpl = artifacts.require("./predictions/factory/ScalarPredictionFactoryImpl.sol");
const SingleNumericOutcomeOracle = artifacts.require("./oracles/types/SingleNumericOutcomeOracle.sol");
const PrizeCalculationBreakEven = artifacts.require("./predictions/prizeCalculations/PrizeCalculationBreakEven.sol");
const PrizeCalculationRelative = artifacts.require("./predictions/prizeCalculations/PrizeCalculationRelative.sol");
//const IPredictionMethods = artifacts.require("./predictions/methods/IPredictionMethodws.sol");

let stoxTestToken;

//Prediction variables
let predictionFactory;
let upgradablePredictionFactory;
let iPoolPredictionFactoryImpl;
let poolPredictionFactoryImpl;
let upgradableOracleFactory;
let iUpgradableOracleFactoryImpl;
let oracleFactoryImpl;
let oracle;

//Wallet variables
let walletRelayDispatcher;
let upgradableSmartWallet;
let newWalletImpl;
let newWalletImpl2;
let player1UpgradableWallet;
let iPlayer1UpgradableSmartWallet;
let player2UpgradableWallet;
let iPlayer2UpgradableSmartWallet;

//Accounts
let player1Account;
let player2Account;
let backupAccount;
let feesAccount;

function isEventArgValid(arg_value, expected_value){
    return (arg_value == expected_value);
}

function isEventNumberBytesArgValid(arg_value, expected_value){
    return (arg_value == web3utils.padRight(web3utils.numberToHex(expected_value),64));
}

function isEventStringBytesArgValid(arg_value, expected_value){
    return (arg_value == web3utils.padRight(web3utils.asciiToHex(expected_value),64));
}

function getLog(result, name, logIndex = 0) {
    return result.logs[logIndex][name];
}

function getLogArg(result, arg, logIndex = 0) {
    return result.logs[logIndex].args[arg];
}

contract ('UpgradableWalletWithPredictionTest', function(accounts) {
    let backupAccount             = accounts[0];
    let feesAccount               = accounts[1];
    let factoryOperator           = accounts[2];
    let oracleOperator            = accounts[3];
    let predictionOperator        = accounts[4];
    let walletsOperator           = accounts[5];
    let player1Account            = accounts[6];
    let player2Account            = accounts[7];
    let player3Account            = accounts[8];

    let tommorowInSeconds;
    let nowInSeconds;

    async function initOracle() {
        await iUpgradableOracleFactoryImpl.createMultipleOutcomeOracle("Test Oracle", {from: oracleOperator}).then(function(result) {
            oracle = MultipleOutcomeOracle.at(getLogArg(result, "_newOracle"));
        });
    }

    async function initPredictionInfra() {
        
        oracleFactoryImpl = await OracleFactoryImpl.new()
        upgradableOracleFactory = await UpgradableOracleFactory.new(oracleFactoryImpl.address, {from: oracleOperator});
        iUpgradableOracleFactoryImpl = IUpgradableOracleFactoryImpl.at(upgradableOracleFactory.address, {from: oracleOperator});
        
        poolPredictionFactoryImpl = await PoolPredictionFactoryImpl.new();
        upgradablePredictionFactory = await UpgradablePredictionFactory.new(poolPredictionFactoryImpl.address, {from: predictionOperator});
        iPoolPredictionFactoryImpl = IPoolPredictionFactoryImpl.at(upgradablePredictionFactory.address, {from: predictionOperator});
        
        scalarPredictionFactoryImpl = await ScalarPredictionFactoryImpl.new();
        upgradablePredictionFactory = await UpgradablePredictionFactory.new(scalarPredictionFactoryImpl.address, {from: predictionOperator});
        iScalarPredictionFactoryImpl = IScalarPredictionFactoryImpl.at(upgradablePredictionFactory.address, {from: predictionOperator});
       
        prizeCalculationBreakEven = await PrizeCalculationBreakEven.new();
        prizeCalculationRelative = await PrizeCalculationRelative.new();

        var tomorrow = new Date();
        tomorrow.setDate((new Date).getDate() + 1);
        tommorowInSeconds = Math.round(tomorrow.getTime() / 1000);
        nowInSeconds = Math.round((new Date()).getTime() / 1000);

        await initOracle();
      
    }

    async function initScalarPrediction(prizeCalculation) {
        let scalarPrediction;
        await iScalarPredictionFactoryImpl.createScalarPrediction(oracle.address, tommorowInSeconds, tommorowInSeconds, "Test Prediction", stoxTestToken.address, prizeCalculation, {from: predictionOperator}).then(function(result) {
            scalarPrediction = ScalarPrediction.at(getLogArg(result, "_newPrediction"));
        });
        
        return scalarPrediction;
    }

    async function initPrediction(prizeCalculation) {
        let poolPrediction;
        await iPoolPredictionFactoryImpl.createPoolPrediction(oracle.address, tommorowInSeconds, tommorowInSeconds, "Test Prediction", stoxTestToken.address, prizeCalculation, {from: predictionOperator}).then(function(result) {
            poolPrediction = PoolPrediction.at(getLogArg(result, "_newPrediction"));
        });
        
        return poolPrediction;
    }

    async function initPredictionWithOutcomes(prizeCalculation) {
        let poolPrediction = await initPrediction(prizeCalculation);

        await poolPrediction.addOutcome("o1", {from: predictionOperator});
        await poolPrediction.addOutcome("o2", {from: predictionOperator});
        await poolPrediction.addOutcome("o3", {from: predictionOperator});

        return poolPrediction;
    }

    async function initWallets() {
        
        newWalletImpl = await NewWalletImpl.new();
        walletRelayDispatcher = await RelayDispatcher.new(walletsOperator, newWalletImpl.address);

        player1UpgradableWallet = await UpgradableSmartWallet.new(backupAccount,walletsOperator, feesAccount, walletRelayDispatcher.address);
        player2UpgradableWallet = await UpgradableSmartWallet.new(backupAccount,walletsOperator, feesAccount, walletRelayDispatcher.address);
                
        iPlayer1UpgradableSmartWallet = INewWalletImpl.at(player1UpgradableWallet.address);
        iPlayer2UpgradableSmartWallet = INewWalletImpl.at(player2UpgradableWallet.address);

        await iPlayer1UpgradableSmartWallet.setUserWithdrawalAccount(player1Account,{from: walletsOperator});
        await iPlayer2UpgradableSmartWallet.setUserWithdrawalAccount(player2Account,{from: walletsOperator});
       
    }

    async function initTokens() {
        
        // Clear existing tokens
        let player1Tokens = await stoxTestToken.balanceOf.call(player1Account);
        let player2Tokens = await stoxTestToken.balanceOf.call(player2Account);
        let backupAccountTokens = await stoxTestToken.balanceOf.call(backupAccount);
        let feesAccountTokens = await stoxTestToken.balanceOf.call(feesAccount);
        let player1UpgradableWalletTokens = await stoxTestToken.balanceOf.call(player1UpgradableWallet.address);
        let player2UpgradableWalletTokens = await stoxTestToken.balanceOf.call(player2UpgradableWallet.address);
        
        await stoxTestToken.destroy(player1Account, player1Tokens);
        await stoxTestToken.destroy(player2Account, player2Tokens);
        await stoxTestToken.destroy(backupAccount, backupAccountTokens);
        await stoxTestToken.destroy(feesAccount, feesAccountTokens);
        await stoxTestToken.destroy(player1UpgradableWallet.address, player1UpgradableWalletTokens);
        await stoxTestToken.destroy(player2UpgradableWallet.address, player2UpgradableWalletTokens);
        
        // Issue new tokens to Wallets
        await stoxTestToken.issue(player1UpgradableWallet.address, 1000);
        await stoxTestToken.issue(player2UpgradableWallet.address, 2000);
         
    }    

    before(async function() {
        // runs before all tests in this block
        stoxTestToken = await ExtendedERC20Token.new("Stox Text", "STX", 18);
        stoxTestToken.totalSupply = 10000;

        await initPredictionInfra();

      });
      
      it("Verify set of new wallet impl and new vote type", async function() {
        await initWallets();
        await initTokens();
         
        newWalletImpl2 = await NewWalletImpl2.new();
        await walletRelayDispatcher.setSmartWalletImplAddress(newWalletImpl2.address, {from: walletsOperator});
                
        await iUpgradableOracleFactoryImpl.createSingleNumericOutcomeOracle("Test Oracle", {from: oracleOperator}).then(function(result) {
            oracle = SingleNumericOutcomeOracle.at(getLogArg(result, "_newOracle"));
        });
        
        let scalarPrediction = await initScalarPrediction(prizeCalculationBreakEven.address);
        await scalarPrediction.publish({from: predictionOperator});
        
        iPlayer1UpgradableSmartWallet = INewWalletImpl2.at(player1UpgradableWallet.address);

        tx_result = await iPlayer1UpgradableSmartWallet.voteOnScalarPrediction(stoxTestToken.address, scalarPrediction.address, 100, 500);
        
        let event  = getLog(tx_result,"event")
        assert.equal(event,"VoteOnScalarPrediction")
        
      });
      
      it("Verify a user can refund her token placement of a cancelled Scalar prediction", async function() {
        await initWallets();
        await initTokens();
         
        newWalletImpl2 = await NewWalletImpl2.new();
        await walletRelayDispatcher.setSmartWalletImplAddress(newWalletImpl2.address, {from: walletsOperator});
                
        await iUpgradableOracleFactoryImpl.createSingleNumericOutcomeOracle("Test Oracle", {from: oracleOperator}).then(function(result) {
            oracle = SingleNumericOutcomeOracle.at(getLogArg(result, "_newOracle"));
        });
        
        let scalarPrediction = await initScalarPrediction(prizeCalculationBreakEven.address);
        await scalarPrediction.publish({from: predictionOperator});
        
        iPlayer1UpgradableSmartWallet = INewWalletImpl2.at(player1UpgradableWallet.address);

        await iPlayer1UpgradableSmartWallet.voteOnScalarPrediction(stoxTestToken.address, scalarPrediction.address, 100, 500);
        
        await scalarPrediction.cancel({from: predictionOperator});
        
        tx_result = await iPlayer1UpgradableSmartWallet.getScalarPredictionRefund(scalarPrediction.address, 100);

        let event  = getLog(tx_result,"event")
        assert.equal(event,"GetScalarPredictionRefund")

      });
      
      it("Verify a user can refund her token placement of a cancelled Pool prediction", async function() {
        await initWallets();
        await initTokens();
                
        let poolPrediction = await initPredictionWithOutcomes(prizeCalculationRelative.address);
        await poolPrediction.publish({from: predictionOperator});
 
        await iPlayer1UpgradableSmartWallet.voteOnPoolPrediction(stoxTestToken.address, poolPrediction.address, "o1", 500);
        
        await poolPrediction.cancel({from:predictionOperator});
        
        tx_result = await iPlayer1UpgradableSmartWallet.getPoolPredictionRefund(poolPrediction.address, "o1");

        let event  = getLog(tx_result,"event")
        assert.equal(event,"GetPoolPredictionRefund")
  
       });
      
      it("Verify upgradable wallet vote on upgradable prediction outcome", async function() {
        await initWallets();
        await initTokens();
                
        let poolPrediction = await initPredictionWithOutcomes(prizeCalculationRelative.address);
        await poolPrediction.publish({from: predictionOperator});
 
        await iPlayer1UpgradableSmartWallet.voteOnPoolPrediction(stoxTestToken.address, poolPrediction.address, "o1", 500);
        
        let predictionBalance = await stoxTestToken.balanceOf.call(poolPrediction.address);
        assert.equal(predictionBalance.toNumber(),500);
       
       });

       it("Verify vote on upgradable prediction outcome event fired", async function() {
        await initWallets();
        await initTokens();
                
        let poolPrediction = await initPredictionWithOutcomes(prizeCalculationRelative.address);
        await poolPrediction.publish({from: predictionOperator});
 
        tx_result = await iPlayer1UpgradableSmartWallet.voteOnPoolPrediction(stoxTestToken.address, poolPrediction.address, "o1", 500);
        
        let event  = getLog(tx_result,"event")
        assert.equal(event,"VoteOnPoolPrediction")
  
       });

       it("Verify vote on upgradable prediction outcome event arguments correct", async function() {
        await initWallets();
        await initTokens();
                
        let poolPrediction = await initPredictionWithOutcomes(prizeCalculationRelative.address);
        await poolPrediction.publish({from: predictionOperator});
 
        tx_result = await iPlayer1UpgradableSmartWallet.voteOnPoolPrediction(stoxTestToken.address, poolPrediction.address, "o1", 500);
        
        let event  = getLog(tx_result,"event")
        assert.equal(event,"VoteOnPoolPrediction")

        assert.equal(isEventArgValid(getLogArg(tx_result,"_prediction"),poolPrediction.address), true);
        assert.equal(isEventStringBytesArgValid(getLogArg(tx_result,"_outcome"),"o1"), true);
        assert.equal(isEventArgValid(getLogArg(tx_result,"_amount"),500), true);
  
       });
       
       it("verify that a user can withdraw funds from a unit", async function() {
        await initWallets();
        await initTokens();
        await initOracle();
               
        let poolPrediction = await initPredictionWithOutcomes(prizeCalculationRelative.address);
        await poolPrediction.publish({from: predictionOperator});
       
        await iPlayer1UpgradableSmartWallet.voteOnPoolPrediction(stoxTestToken.address, poolPrediction.address,"o1",1000); 
        await iPlayer2UpgradableSmartWallet.voteOnPoolPrediction(stoxTestToken.address, poolPrediction.address,"o2",2000);
        
        await poolPrediction.pause({from: predictionOperator});
        await poolPrediction.setTokensPlacementBuyingEndTime(nowInSeconds - 1000, {from: predictionOperator});
       
        await poolPrediction.publish({from: predictionOperator});
        await oracle.registerPrediction(poolPrediction.address, {from: oracleOperator});
        await oracle.setOutcome(poolPrediction.address, "o1", {from: oracleOperator});

        await poolPrediction.resolve({from: predictionOperator});
        
        //await iPlayer1UpgradableSmartWallet.withdrawFromPoolPrediction(poolPrediction.address);
        
        await iPlayer1UpgradableSmartWallet.withdrawFromPrediction(poolPrediction.address);
        
        let player1UpgradableSmartWalletTokens = await stoxTestToken.balanceOf(player1UpgradableWallet.address);
        let tokenPool = await poolPrediction.tokenPool.call();
        let predictionTokens = await stoxTestToken.balanceOf.call(poolPrediction.address);
         
        assert.equal(player1UpgradableSmartWalletTokens, 3000);
        assert.equal(predictionTokens, 0);
        
        });

        it("verify withdraw funds from a unit event fired", async function() {
            await initWallets();
            await initTokens();
            await initOracle();
                   
            let poolPrediction = await initPredictionWithOutcomes(prizeCalculationRelative.address);
            await poolPrediction.publish({from: predictionOperator});
           
            await iPlayer1UpgradableSmartWallet.voteOnPoolPrediction(stoxTestToken.address, poolPrediction.address,"o1",1000); 
            await iPlayer2UpgradableSmartWallet.voteOnPoolPrediction(stoxTestToken.address, poolPrediction.address,"o2",2000);
            
            await poolPrediction.pause({from: predictionOperator});
            await poolPrediction.setTokensPlacementBuyingEndTime(nowInSeconds - 1000, {from: predictionOperator});
           
            await poolPrediction.publish({from: predictionOperator});
            await oracle.registerPrediction(poolPrediction.address, {from: oracleOperator});
            await oracle.setOutcome(poolPrediction.address, "o1", {from: oracleOperator});
    
            await poolPrediction.resolve({from: predictionOperator});
            
            //tx_result =  await iPlayer1UpgradableSmartWallet.withdrawFromPoolPrediction(poolPrediction.address);
            tx_result =  await iPlayer1UpgradableSmartWallet.withdrawFromPrediction(poolPrediction.address);

            
            let event  = getLog(tx_result,"event")
            assert.equal(event,"WithdrawFromPrediction")
          
        });

        it("verify withdraw funds from a unit event arguments correct", async function() {
            await initWallets();
            await initTokens();
            await initOracle();
                   
            let poolPrediction = await initPredictionWithOutcomes(prizeCalculationRelative.address);
            await poolPrediction.publish({from: predictionOperator});
           
            await iPlayer1UpgradableSmartWallet.voteOnPoolPrediction(stoxTestToken.address, poolPrediction.address,"o1",1000); 
            await iPlayer2UpgradableSmartWallet.voteOnPoolPrediction(stoxTestToken.address, poolPrediction.address,"o2",2000);
            
            await poolPrediction.pause({from: predictionOperator});
            await poolPrediction.setTokensPlacementBuyingEndTime(nowInSeconds - 1000, {from: predictionOperator});
           
            await poolPrediction.publish({from: predictionOperator});
            await oracle.registerPrediction(poolPrediction.address, {from: oracleOperator});
            await oracle.setOutcome(poolPrediction.address, "o1", {from: oracleOperator});
    
            await poolPrediction.resolve({from: predictionOperator});
            
            //tx_result =  await iPlayer1UpgradableSmartWallet.withdrawFromPoolPrediction(poolPrediction.address);
            tx_result =  await iPlayer1UpgradableSmartWallet.withdrawFromPrediction(poolPrediction.address);
    

            let event  = getLog(tx_result,"event")
            assert.equal(event,"WithdrawFromPrediction")

            assert.equal(isEventArgValid(getLogArg(tx_result,"_prediction"),poolPrediction.address), true);
          
        });
       
});