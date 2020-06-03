const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const getDifference = testHelpers.getDifference
const moneyVals = testHelpers.MoneyValues

contract('PoolManager', async accounts => {

  const [owner,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    defaulter_5,
    whale,
    whale_2,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    graham,
    harriet
  ] = accounts;

  let priceFeed
  let clvToken
  let poolManager
  let sortedCDPs
  let cdpManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations

  let gasPriceInWei

  describe("Stability Pool Withdrawal to CDP", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      const contracts = await deployLiquity()

      priceFeed = contracts.priceFeed
      clvToken = contracts.clvToken
      poolManager = contracts.poolManager
      sortedCDPs = contracts.sortedCDPs
      cdpManager = contracts.cdpManager
      nameRegistry = contracts.nameRegistry
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      functionCaller = contracts.functionCaller
      borrowerOperations = contracts.borrowerOperations

      const contractAddresses = getAddresses(contracts)
      await connectContracts(contracts, contractAddresses)
    })

    // --- withdrawFromSPtoCDP() ---

    // --- Identical deposits, identical liquidation amounts---
    it("withdrawFromSPtoCDP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulter opens loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Check depositors' compounded deposit is 66.66 CLV and ETH Gain is 0.33 ETH
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '66666666666666666666'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '66666666666666666666'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '66666666666666666666'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '333333333333333333'), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '333333333333333333'), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '333333333333333333'), 1000)
    })

    it("withdrawFromSPtoCDP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit is 33.33 CLV and ETH Gain is 0.66 ETH
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '33333333333333333333'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '33333333333333333333'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '33333333333333333333'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '666666666666666666'), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '666666666666666666'), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '666666666666666666'), 1000)
    })

    it("withdrawFromSPtoCDP():  Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit is 0 CLV and ETH Gain is 1 ETH
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice,  { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '1000000000000000000'), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '1000000000000000000'), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '1000000000000000000'), 1000)
    })

    // --- Identical deposits, increasing liquidation amounts ---
    it("withdrawFromSPtoCDP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two liquidations of increasing CLV", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: '100000000000000000' })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '200000000000000000' })
      await borrowerOperations.withdrawCLV(moneyVals._10e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._20e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit is 0 CLV and ETH Gain is 1 ETH
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '90000000000000000000'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '90000000000000000000'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '90000000000000000000'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '100000000000000000'), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '100000000000000000'), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '100000000000000000'), 1000)
    })

    it("withdrawFromSPtoCDP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three liquidations of increasing CLV", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: '100000000000000000' })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '200000000000000000' })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: '300000000000000000' })
      await borrowerOperations.withdrawCLV(moneyVals._10e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._20e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(moneyVals._30e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit is 80 CLV and ETH Gain is 0.2 ETH
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob,  { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '80000000000000000000'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '80000000000000000000'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '80000000000000000000'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '200000000000000000'), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '200000000000000000'), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '200000000000000000'), 1000)
    })

    // --- Increasing deposits, identical liquidation amounts ---
    it("withdrawFromSPtoCDP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      // Alice deposits 100, Bob deposits 200, Carol deposits 300 CLV
      await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await borrowerOperations.openLoan(moneyVals._200e18, bob, { from: bob, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: bob })

      await borrowerOperations.openLoan(moneyVals._300e18, carol, { from: carol, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._300e18, { from: carol })

      // 2 Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol,{ from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '66666666666666666666'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '133333333333333333333'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '200000000000000000000'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '333333333333333333'), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '666666666666666666'), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '1000000000000000000'), 1000)
    })

    it("withdrawFromSPtoCDP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      // Alice deposits 100, Bob deposits 200, Carol deposits 300 CLV
      await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await borrowerOperations.openLoan(moneyVals._200e18, bob, { from: bob, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: bob })

      await borrowerOperations.openLoan(moneyVals._300e18, carol, { from: carol, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._300e18, { from: carol })

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '50000000000000000000'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '100000000000000000000'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '150000000000000000000'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '500000000000000000'), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '1000000000000000000'), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '1500000000000000000'), 1000)
    })

    // --- Varied depoosits and varied liquidation amount ---
    it("withdrawFromSPtoCDP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three varying liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      /* Depositors provide:-
      Alice:  20 CLV
      Bob:  4560 CLV
      Carol: 131 CLV */
      await borrowerOperations.openLoan('20000000000000000000', alice, { from: alice, value: moneyVals._100_Ether })
      await poolManager.provideToSP('20000000000000000000', { from: alice })

      await borrowerOperations.openLoan('4560000000000000000000', bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP('4560000000000000000000', { from: bob })

      await borrowerOperations.openLoan('131000000000000000000', carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP('131000000000000000000', { from: carol })


      /* Defaulters open loans
     
      Defaulter 1: 2110 CLV & 22 ETH  
      Defaulter 2: 10 CLV & 0.1 ETH  
      Defaulter 3: 467 CLV & 5 ETH
      */
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._22_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '100000000000000000' })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._5_Ether })
      await borrowerOperations.withdrawCLV('2110000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('10000000000000000000', defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV('467000000000000000000', defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '9017193801740610000'), 10000000000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '2055920186796860000000'), 1000000000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '59062619401401000000'), 1000000000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '115049883251961100'), 1000000000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '26231373381447700000'), 1000000000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '753576735300360000'), 1000000000)
    })

    // --- Deposit enters at t > 0

    it("withdrawFromSPtoCDP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 1 liquidation. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides to SP
      await borrowerOperations.openLoan(moneyVals._100e18, dennis, { from: dennis, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: dennis })

      // Third defaulter liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '16666666666666666666'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '16666666666666666666'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '16666666666666666666'), 1000)

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '50000000000000000000'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '833333333333333333'), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '833333333333333333'), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '833333333333333333'), 1000)

      assert.isAtMost(getDifference(dennis_ETHWithdrawn, '500000000000000000'), 1000)
    })

    it("withdrawFromSPtoCDP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides to SP
      await borrowerOperations.openLoan(moneyVals._100e18, dennis, { from: dennis, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: dennis })

      // Third and fourth defaulters liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '0'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, moneyVals._1_Ether), 1000)
    })

    it("withdrawFromSPtoCDP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. Various deposit and liquidation vals.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      /* Depositors open loans and make SP deposit:
      Alice: 600 CLV
      Bob: 200 CLV
      Carol: 150 CLV
      */
      await borrowerOperations.openLoan(moneyVals._600e18, alice, { from: alice, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._600e18, { from: alice })

      await borrowerOperations.openLoan(moneyVals._200e18, bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: bob })

      await borrowerOperations.openLoan(moneyVals._150e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._150e18, { from: carol })

      /* Defaulters open loans:
      Defaulter 1:  100 CLV, 1 ETH
      Defaulter 2:  250 CLV, 2.5 ETH
      Defaulter 3:  50 CLV, 0.5 ETH
      Defaulter 4:  400 CLV, 4 ETH
      */
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '2500000000000000000' })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: '500000000000000000' })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: moneyVals._4_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._250e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(moneyVals._50e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(moneyVals._400e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides 250 CLV
      await borrowerOperations.openLoan(moneyVals._250e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._250e18, { from: dennis })

      // Last two defaulters liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      // Each depositor withdraws as much as possible
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '178328173374613000000'), 1000000000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '59442724458204300000'), 1000000000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '44582043343653200000'), 1000000000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '117647058823529000000'), 1000000000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '4216718266253870000'), 1000000000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '1405572755417960000'), 1000000000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '1054179566563470000'), 1000000000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, '1323529411764710000'), 1000000000)
    })

    // --- Depositor leaves ---

    it("withdrawFromSPtoCDP(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol, dennis]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })

      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '50000000000000000000'), 1000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, '500000000000000000'), 1000)

      // Two more defaulters are liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol,{ from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, moneyVals._1_Ether), 1000)
    })

    it("withdrawFromSPtoCDP(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. Various deposit and liquidation vals. A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      /* Initial deposits:
      Alice: 200 CLV
      Bob: 250 CLV
      Carol: 125 CLV
      Dennis: 400 CLV
      */
      await borrowerOperations.openLoan(moneyVals._200e18, alice, { from: alice, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: alice })

      await borrowerOperations.openLoan(moneyVals._250e18, bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._250e18, { from: bob })

      await borrowerOperations.openLoan(moneyVals._125e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._125e18, { from: carol })

      await borrowerOperations.openLoan(moneyVals._400e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._400e18, { from: dennis })

      /* Defaulters open loans:
      Defaulter 1: 100 CLV
      Defaulter 1: 200 CLV
      Defaulter 1: 300 CLV
      Defaulter 1: 50 CLV
      */
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._2_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._3_Ether })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: '500000000000000000' })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._200e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(moneyVals._300e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(moneyVals._50e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

       // Dennis withdraws his deposit and ETH gain
       const txD = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: dennis })

      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()
      assert.isAtMost(getDifference((await clvToken.balanceOf(dennis)).toString(), '276923076923077000000'), 1000000000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, '1230769230769230000'), 1000000000)

      // Two more defaulters are liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol,{ from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '16722408026755900000'), 100000000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '20903010033444800000'), 1000000000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '10451505016722400000'), 1000000000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '1832775919732440000'), 1000000000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '2290969899665550000'), 1000000000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '1145484949832780000'), 1000000000)
    })

    // --- One deposit enters at t > 0, and another leaves later ---
    it("withdrawFromSPtoCDP(): A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 CLV. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, dennis]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loans
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: '500000000000000000' })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(moneyVals._50e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Carol makes deposit
      await borrowerOperations.openLoan(moneyVals._100e18, carol, { from: carol, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: dennis })

      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()
      assert.isAtMost(getDifference((await clvToken.balanceOf(dennis)).toString(), '16666666666666666666'), 1000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, '833333333333333333'), 1000)

      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob,{ from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '6666666666666666666'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '6666666666666666666'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '20000000000000000000'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '933333333333333333'), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '933333333333333333'), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '800000000000000000'), 1000)
    })

    // --- Tests for full offset - Pool empties to 0 ---

    // A, B deposit 100
    // L1 cancels 200, 2
    // C, D deposit 100
    // L2 cancels 100,1 

    // A, B withdraw 0c & 1e
    // C, D withdraw 50c  & 0.5e
    it("withdrawFromSPtoCDP(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // 2 Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._2_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._200e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 100 CLV
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // await borrowerOperations.openLoan(moneyVals._1e18, account, { from: erin, value: moneyVals._2_Ether })
      // await poolManager.provideToSP(moneyVals._1e18, { from: erin })

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })

      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()

      // Expect Alice And Bob's compounded deposit to be 0 CLV
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)

      // Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.isAtMost(getDifference(alice_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, moneyVals._1_Ether), 1000)

      // Expect Carol And Dennis' compounded deposit to be 50 CLV
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '50000000000000000000'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '50000000000000000000'), 1000)

      // Expect Carol and and Dennis ETH Gain to be 0.5 ETH
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '500000000000000000'), 1000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, '500000000000000000'), 1000)
    })

    // A, B deposit 100
    // L1 cancels 200, 2
    // C, D, E deposit 100, 200, 300
    // L2 cancels 100,1 

    // A, B withdraw 0c & 1e
    // C, D withdraw 50c  & 0.5e
    it("withdrawFromSPtoCDP(): Depositors withdraw correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // 2 Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._2_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._200e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis, Erin each deposit 100, 200, 300 CLV respectively
      await borrowerOperations.openLoan(moneyVals._100e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      await borrowerOperations.openLoan(moneyVals._200e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: dennis })

      await borrowerOperations.openLoan(moneyVals._300e18, erin, { from: erin, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._300e18, { from: erin })

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // await borrowerOperations.openLoan(moneyVals._1e18, account, { from: flyn, value: moneyVals._2_Ether })
      // await poolManager.provideToSP(moneyVals._1e18, { from: flyn })

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })
      const txE = await poolManager.withdrawFromSPtoCDP(erin, erin, { from: erin })

      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()
      const erin_ETHWithdrawn = txE.logs[1].args[1].toString()

      // Expect Alice And Bob's compounded deposit to be 0 CLV
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '83333333333333333333'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '166666666666666666666'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(erin)).toString(), '250000000000000000000'), 1000)

      //Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.isAtMost(getDifference(alice_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, moneyVals._1_Ether), 1000)

      assert.isAtMost(getDifference(carol_ETHWithdrawn, '166666666666666666'), 1000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, '333333333333333333'), 1000)
      assert.isAtMost(getDifference(erin_ETHWithdrawn, '500000000000000000'), 1000)
    })

    // A deposits 100
    // L1, L2, L3 liquidated with 100 CLV each
    // A withdraws all
    // Expect A to withdraw 0 deposit and ether only from reward L1
    it("withdrawFromSPtoCDP(): single deposit fully offset. After subsequent liquidations, depositor withdraws 0 deposit and *only* the ETH Gain from one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1,2,3 withdraw 'almost' 100 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })

      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1, 2  and 3 liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      await cdpManager.liquidate(defaulter_2, { from: owner });

      await cdpManager.liquidate(defaulter_3, { from: owner });

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = await txA.logs[1].args[1].toString()

      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), 0), 1000)
      assert.isAtMost(getDifference(alice_ETHWithdrawn, moneyVals._1_Ether), 1000)
    })

    //--- Serial full offsets ---

    // A,B deposit 100C
    // L1 cancels 200C, 2E
    // B,C deposits 100C
    // L2 cancels 200C, 2E
    // E,F deposit 100C
    // L3 cancels 200C, 2E
    // G,H deposits 100C
    // L4 cancels 200C, 2E

    // Expect all depositors withdraw 0 CLV and 1 ETH

    it("withdrawFromSPtoCDP(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      // 4 Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._2_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._200e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._2_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._200e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._2_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._200e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: moneyVals._2_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._200e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._100_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 100 CLV
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._100_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Erin, Flyn each deposit 100 CLV
      const depositors_3 = [erin, flyn]
      for (account of depositors_3) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._100_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulter 3 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Graham, Harriet each deposit 100 CLV
      const depositors_4 = [graham, harriet]
      for (account of depositors_4) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._100_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulter 4 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_4, { from: owner });

      // await borrowerOperations.withdrawCLV(moneyVals._1e18, whale, { from: whale })
      // await poolManager.provideToSP(moneyVals._1e18, { from: whale })

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })
      const txE = await poolManager.withdrawFromSPtoCDP(erin, erin, { from: erin })
      const txF = await poolManager.withdrawFromSPtoCDP(flyn, flyn, { from: flyn })
      const txG = await poolManager.withdrawFromSPtoCDP(graham, graham, { from: graham })
      const txH = await poolManager.withdrawFromSPtoCDP(harriet, harriet, { from: harriet })

      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()
      const erin_ETHWithdrawn = txE.logs[1].args[1].toString()
      const flyn_ETHWithdrawn = txF.logs[1].args[1].toString()
      const graham_ETHWithdrawn = txG.logs[1].args[1].toString()
      const harriet_ETHWithdrawn = txH.logs[1].args[1].toString()

      // Expect all deposits to be 0 CLV
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(erin)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(flyn)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(graham)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(harriet)).toString(), '0'), 1000)

      /* Expect all ETH gains to be 1 ETH:  Since each liquidation of empties the pool, depositors
      should only earn ETH from the single liquidation that cancelled with their deposit */
      assert.isAtMost(getDifference(alice_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(erin_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(flyn_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(graham_ETHWithdrawn, moneyVals._1_Ether), 1000)
      assert.isAtMost(getDifference(harriet_ETHWithdrawn, moneyVals._1_Ether), 1000)
    })


    // --- Scale factor tests ---

    // A deposits 100
    // L1 brings P close to boundary, i.e. 1e-18 - 99.9999999?
    // A withdraws all
    // B deposits 100
    // L2 brings of 90, should bring P slightly past boundary i.e. 1e-18 -> 1e-19

    // expect d(B) = d0(B)/10
    // expect correct ETH gain, i.e. all of the reward
    it("withdrawFromSPtoCDP(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1 withdraws 'almost' 100 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999999999000', defaulter_1, { from: defaulter_1 })

      // Defaulter 2 withdraws 90 CLV
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '500000000000000000' })
      await borrowerOperations.withdrawCLV(moneyVals._90e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated.  Value of P reduced to 9.
      await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await poolManager.P()).toString(), '9')

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = await txA.logs[1].args[1].toString()

      await borrowerOperations.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      // Defaulter 2 liquidated.  90 CLV liquidated. P altered by a factor of (1-90/100) = 0.1.  Scale changed.
      await cdpManager.liquidate(defaulter_2, { from: owner });
 
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const bob_ETHWithdrawn = await txB.logs[1].args[1].toString()

      // Expect Bob to withdraw 10% of initial deposit (10 CLV) and all the liquidated ETH (0.5 ether)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '10000000000000000000'), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '500000000000000000'), 1000)
    })


    // A deposits 100
    // L1 brings P close to boundary, i.e. 1e-18 - 99.9999999?
    // A withdraws all
    // B, C, D deposit 100, 200, 300
    // L2 brings of 90, should bring P slightly past boundary i.e. 1e-18 -> 1e-19

    // expect d(B) = d0(B)/10
    // expect correct ETH gain, i.e. all of the reward
    it("withdrawFromSPtoCDP(): Several deposits of varying amounts span one scale factor change. Depositors withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1 withdraws 'almost' 100 CLV.
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999999999000', defaulter_1, { from: defaulter_1 })

      // Defaulter 2 withdraws 540 CLV
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._3_Ether })
      await borrowerOperations.withdrawCLV('540000000000000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated.  Value of P reduced to 9.
      await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await poolManager.P()).toString(), '9')

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })

      await borrowerOperations.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      await borrowerOperations.openLoan(moneyVals._200e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: carol })

      await borrowerOperations.openLoan(moneyVals._300e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._300e18, { from: dennis })

      // 540 CLV liquidated.  P altered by a factor of (1-540/600) = 0.1. Scale changed.
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })

      /* Expect depositors to withdraw 10% of their initial deposit, and an ETH gain 
      in proportion to their initial deposit:
     
      Bob:  10 CLV, 0.5 Ether
      Carol:  20 CLV, 1 Ether
      Dennis:  30 CLV, 1.5 Ether
     
      Total: 60 CLV, 3 Ether
      */
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), moneyVals._10e18), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), moneyVals._20e18), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), moneyVals._30e18), 1000)

      const bob_ETHWithdrawn = await txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = await txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = await txD.logs[1].args[1].toString()

      assert.isAtMost(getDifference(bob_ETHWithdrawn, '500000000000000000'), 1000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '1000000000000000000'), 1000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, '1500000000000000000'), 1000)
    })


    // Deposit's ETH reward spans one scale -  deposit reduced by factor of < 1e18

    // A make deposit 100 CLV
    // L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV
    // A withdraws
    // B makes deposit 100 CLV
    // L2 decreases P again by (1e-10)), over boundary: 99.999999999000000000 (near to the 100 CLV total deposits)
    // B withdraws
    // expect d(B) = d0(B) * (1e-10)
    // expect B gets entire ETH gain from L2
    it("withdrawFromSPtoCDP(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1 and default 2 each withdraw 99.999999999 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_1, { from: defaulter_1 })

      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter 1 ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      // Alice withdraws
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      // Bob deposits 100 CLV
      await borrowerOperations.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })
      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const bob_ETHWithdrawn = await txB.logs[1].args[1].toString()

      // Bob should withdraw 0 deposit, and the full ETH gain of 1 ether
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), 0), 1000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '1000000000000000000'), 1000000000)
    })

    // A make deposit 100 CLV
    // L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV
    // A withdraws
    // B,C D make deposit 100, 200, 300
    // L2 decreases P again by (1e-10)), over boundary. L2: 599.999999994000000000  (near to the 600 CLV total deposits)
    // B withdraws
    // expect d(B) = d0(B) * (1e-10)
    // expect B gets entire ETH gain from L2
    it("withdrawFromSPtoCDP(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1 and default 2 each withdraw 99.999999999 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_1, { from: defaulter_1 })

      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._6_Ether })
      await borrowerOperations.withdrawCLV('599999999994000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      // Alice withdraws
      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })

      // B, C, D deposit 100, 200, 300 CLV
      await borrowerOperations.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      await borrowerOperations.openLoan(moneyVals._200e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: carol })

      await borrowerOperations.openLoan(moneyVals._300e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._300e18, { from: dennis })

      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const bob_ETHWithdrawn = await txB.logs[1].args[1].toString()

      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      const carol_ETHWithdrawn = await txC.logs[1].args[1].toString()

      const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })
      const dennis_ETHWithdrawn = await txD.logs[1].args[1].toString()

      // B, C and D should withdraw 1e-10 of initial deposit, 
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '0'), 1000)

      assert.isAtMost(getDifference(bob_ETHWithdrawn, moneyVals._1_Ether), 100000000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, moneyVals._2_Ether), 1000000000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, moneyVals._3_Ether), 1000000000)
    })

    // --- Serial scale changes ---

    /* A make deposit 100 CLV
    L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV, 1 ETH
    B makes deposit 100
    L2 decreases P by(~1e-10)P. L2:  99.999999999000000000 CLV, 1 ETH
    C makes deposit 100
    L2 decreases P by(~1e-10)P. L2:  99.999999999000000000 CLV, 1 ETH
    C makes deposit 100
    L3 decreases P by(~1e-10)P. L2:  99.999999999000000000 CLV, 1 ETH
    D makes deposit 100
    L4 decreases P by(~1e-10)P. L2:  99.999999999000000000 CLV, 1 ETH
    expect A, B, C, D each withdraw ~1e-10 CLV and ~1 Ether
    */
    it("withdrawFromSPtoCDP(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      // Defaulters 1-4 each withdraw 99.999999999 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_1, { from: defaulter_1 })

      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_2, { from: defaulter_2 })

      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_3, { from: defaulter_3 })

      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_4, { from: defaulter_4 })

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      // B deposits 100CLV
      await borrowerOperations.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      await borrowerOperations.openLoan(moneyVals._100e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Defaulter 3 liquidated
      const txL3 = await cdpManager.liquidate(defaulter_3, { from: owner });
      assert.isTrue(txL3.receipt.status)

      await borrowerOperations.openLoan(moneyVals._100e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: dennis })

      // Defaulter 4 liquidated
      const txL4 = await cdpManager.liquidate(defaulter_4, { from: owner });
      assert.isTrue(txL4.receipt.status)

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      const txC = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })

      const alice_ETHWithdrawn = await txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = await txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = await txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = await txD.logs[1].args[1].toString()

      // B, C and D should withdraw 1e-10 of initial deposit, 

      // TODO:  check deposit magnitudes are correct
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)
      assert.isAtMost(getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '0'), 1000)

      assert.isAtMost(getDifference(alice_ETHWithdrawn, '1000000000010000000'), 1000000000)
      assert.isAtMost(getDifference(bob_ETHWithdrawn, '1000000000010000000'), 1000000000)
      assert.isAtMost(getDifference(carol_ETHWithdrawn, '1000000000010000000'), 1000000000)
      assert.isAtMost(getDifference(dennis_ETHWithdrawn, '999999999970000000'), 1000000000)
    })

    // --- Extreme values, confirm no overflows ---

    it("withdrawFromSPtoCDP(): Large liquidated coll/debt, deposits and ETH price", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100billion_Ether })

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(moneyVals._2e27);
      const price = await priceFeed.getPrice()

      const depositors = [alice, bob]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._1e36, account, { from: account, value: moneyVals._1billion_Ether })
        await poolManager.provideToSP(moneyVals._1e36, { from: account })
      }

      // Defaulter opens loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1billion_Ether })
      await borrowerOperations.withdrawCLV(moneyVals._1e36, defaulter_1, { from: defaulter_1 })

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(moneyVals._1e27);

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1]
      const bob_ETHWithdrawn = txB.logs[1].args[1]

      aliceCLVDeposit = await poolManager.getCompoundedCLVDeposit(alice)
      bobCLVDeposit = await poolManager.getCompoundedCLVDeposit(alice)
      
      aliceExpectedCLVDeposit = web3.utils.toBN(moneyVals._5e35)
      bobExpectedCLVDeposit = web3.utils.toBN(moneyVals._5e35)
      
      aliceDepositDiff = aliceCLVDeposit.sub(aliceExpectedCLVDeposit).abs()

      assert.isTrue(aliceDepositDiff.lte(web3.utils.toBN('1000000000000000000')))

      bobDepositDiff = bobCLVDeposit.sub(bobExpectedCLVDeposit).abs()

      assert.isTrue(bobDepositDiff.lte(web3.utils.toBN('1000000000000000000')))

      aliceExpectedETHGain = web3.utils.toBN(moneyVals._500million_Ether)
      aliceETHDiff = aliceExpectedETHGain.sub(alice_ETHWithdrawn)

      assert.isTrue(aliceETHDiff.lte(web3.utils.toBN('1000000000000000000')))

      bobExpectedETHGain = web3.utils.toBN(moneyVals._500million_Ether)
      bobETHDiff = bobExpectedETHGain.sub(bob_ETHWithdrawn)

      assert.isTrue(bobETHDiff.lte(web3.utils.toBN('1000000000000000000')))

      //  assert.isAtMost(getDifference(alice_ETHWithdrawn, moneyVals._500million_Ether), web3.utils.toBN('1000000000000000000'))
      //  assert.isAtMost(getDifference(bob_ETHWithdrawn, moneyVals._500million_Ether), web3.utils.toBN('1000000000000000000'))
    })

    it("withdrawFromSPtoCDP(): Tiny liquidated coll/debt, large deposits and ETH price", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100billion_Ether })

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(moneyVals._2e27);
      const price = await priceFeed.getPrice()

      const depositors = [alice, bob]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._1e36, account, { from: account, value: moneyVals._1billion_Ether })
        await poolManager.provideToSP(moneyVals._1e36, { from: account })
      }

      // Defaulter opens loan with 20e-9 ETH (with minimum value of $20) and 20 CLV. 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: '20000000000' })
      await borrowerOperations.withdrawCLV(moneyVals._20e18, defaulter_1, { from: defaulter_1 })

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(moneyVals._1e27);

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      const txA = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      const txB = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })

      const alice_ETHWithdrawn = txA.logs[1].args[1]
      const bob_ETHWithdrawn = txB.logs[1].args[1]


      aliceCLVDeposit = await poolManager.getCompoundedCLVDeposit(alice)
      bobCLVDeposit = await poolManager.getCompoundedCLVDeposit(alice)
      
      aliceExpectedCLVDeposit = web3.utils.toBN('999999999999999990000000000000000000')
      bobExpectedCLVDeposit = web3.utils.toBN('999999999999999990000000000000000000')

      aliceDepositDiff = aliceCLVDeposit.sub(aliceExpectedCLVDeposit).abs()

      assert.isTrue(aliceDepositDiff.lte(web3.utils.toBN('1000000000000000000')))

      bobDepositDiff = bobCLVDeposit.sub(bobExpectedCLVDeposit).abs()

      assert.isTrue(bobDepositDiff.lte(web3.utils.toBN('1000000000000000000')))

      // Expect ETH gain per depositor of 1e9 wei to be rounded to 0 by the ETHGainedPerUnitStaked calculation (e / D), where D is ~1e36.
      assert.equal(alice_ETHWithdrawn.toString(), '0')
      assert.equal(bob_ETHWithdrawn.toString(), '0')
    })
  })
})

contract('Reset chain state', async accounts => { })
