import { useState, useEffect } from 'react';
import { useFormik, FormikErrors, FormikTouched } from 'formik';
import dayjs from 'dayjs';
import { ethers } from 'ethers';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import { useToast } from '@chakra-ui/react';
import { useParams } from '@reach/router';

// common
import { useSignedContract } from 'modules/common/hooks/useSignedContract';
import { CONTRACT_ADDRESSES } from 'modules/common/lib/constants';
import { useWeb3 } from 'modules/common/hooks/useWeb3';
import { parseTransaction } from 'modules/common/lib/parsers/parseTransaction';
import { useUserContractRoles } from 'modules/common/hooks/useUserContractRoles';
import { RequestPaymentValidationSchema } from 'modules/common/lib/validations';
import { useFundInformation } from 'modules/common/hooks/useFundInformation';
import SAFEGUARD_JSON from 'modules/common/lib/abis/SafeGuard.json';
import TOKEN_JSON from 'modules/common/lib/abis/Comp.json';
import TIMELOCK_JSON from 'modules/common/lib/abis/Timelock.json';

// manager
import { InitialValuesRequestFunds } from 'modules/manager/lib/types';
import { getTransactionEta } from 'modules/manager/lib/helpers';

// admin
import { Transaction } from 'modules/admin/lib/types';

dayjs.extend(advancedFormat);

const initialValues: InitialValuesRequestFunds = {
  unitType: '',
  amount: '',
  address: '',
  description: '',
};

type Values = {
  transactions?: Transaction[];
  cancelTransaction: (transaction: Transaction) => Promise<void>;
  executeTransaction: (transaction: Transaction) => Promise<void>;
  isSubmitting: boolean;
  values: InitialValuesRequestFunds;
  submitForm: () => Promise<any>;
  handleChange: {
    (e: React.ChangeEvent<any>): void;
    <T_1 = string | React.ChangeEvent<any>>(field: T_1): T_1 extends React.ChangeEvent<any>
      ? void
      : (e: string | React.ChangeEvent<any>) => void;
  };
  errors: FormikErrors<InitialValuesRequestFunds>;
  touched: FormikTouched<InitialValuesRequestFunds>;
};

export const useTransactions = (): Values => {
  // router hooks
  const { safeGuardAddress } = useParams();

  // react hooks
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSubmitting, setSubmitting] = useState(false);

  // chakra hooks
  const toast = useToast();

  // constants
  const tokenAddress = CONTRACT_ADDRESSES.token[process.env.REACT_APP_ETHEREUM_NETWORK];

  // custom hook
  const { timelockAddress } = useFundInformation();
  const { signedContract: signedTimelockContract } = useSignedContract({
    contractAddress: timelockAddress,
    contractAbi: TIMELOCK_JSON.abi,
  });

  const { signedContract: signedRolContract } = useSignedContract({
    contractAddress: safeGuardAddress,
    contractAbi: SAFEGUARD_JSON.abi,
  });

  const { web3 } = useWeb3();
  const { hasCancelerRole, hasExecutorRole, hasProposerRole } = useUserContractRoles();

  useEffect(() => {
    const getTimelockEvents = async () => {
      try {
        const queuedEventFilter = await signedRolContract?.filters.QueueTransactionWithDescription();
        const queuedTransactions =
          queuedEventFilter && (await signedRolContract?.queryFilter(queuedEventFilter));
  
        const canceledEventFilter = await signedTimelockContract?.filters.CancelTransaction();
        const canceledTransactions =
          canceledEventFilter && (await signedTimelockContract?.queryFilter(canceledEventFilter));
  
        const executedEventFilter = await signedTimelockContract?.filters.ExecuteTransaction();
        const executedTransactions =
          executedEventFilter && (await signedTimelockContract?.queryFilter(executedEventFilter));
  
        const gracePeriodLabel = await signedTimelockContract?.GRACE_PERIOD();
        const gracePeriod = Number(gracePeriodLabel.toString());
        const currentTimestamp = Number(dayjs().format('X'));
  
        const transactionInfo = queuedTransactions?.map(
          (item) => item.args && parseTransaction(item.args, gracePeriod),
        );
  
        const allTransactions = (transactionInfo &&
          (await Promise.all(
            transactionInfo.map(async (item) => {
              if (item) {
                return {
                  ...item,
                  currentlyQueued:
                  signedTimelockContract &&
                    (await signedTimelockContract?.queuedTransactions(item.txHash)),
                  canceled:
                    canceledTransactions &&
                    canceledTransactions?.some((canceled) => canceled.args?.txHash === item.txHash),
                  executed:
                    executedTransactions &&
                    executedTransactions?.some((executed) => executed.args?.txHash === item.txHash),
                  stale:
                    executedTransactions &&
                    !executedTransactions.some((executed) => executed.args?.txHash === item.txHash) &&
                    item.executableTime <= currentTimestamp,
                };
              }
            }),
          ))) as Transaction[];
  
        const sortedTransactions = allTransactions.sort(
          (a, b) => b.executableTime - a.executableTime,
        );
  
        setTransactions(sortedTransactions);
      } catch (error) {
        console.log('🚀 ~ ~ error', error);
      }
    };

    if (signedTimelockContract) getTimelockEvents();
  }, [signedTimelockContract]);

  useEffect(() => {
    if (!signedTimelockContract) return;

    signedTimelockContract.on('QueueTransaction', (event) => {
      event.removeListener(); 
      event.removeListener(); 

      const transactionsUpdated = transactions?.map(item => item.txHash === event.txHash ? { ...item, currentlyQueued: true} : item)

      setTransactions(transactionsUpdated)
    });

    signedTimelockContract.on('ExecuteTransaction', (event) => {
      event.removeListener(); 
      event.removeListener(); 

      const transactionsUpdated = transactions?.map(item => item.txHash === event.txHash ? { ...item, executed: true} : item)

      setTransactions(transactionsUpdated)
    });

    signedTimelockContract.on('CancelTransaction', (event) => {
      event.removeListener(); 

      const transactionsUpdated = transactions?.map(item => item.txHash === event.txHash ? { ...item, canceled: true} : item)

      setTransactions(transactionsUpdated)
    });

  }, []);

  // handlers
  const cancelTransaction = async (transaction: Transaction) => {
    if (!hasCancelerRole) {
      toast({
        title: 'Error',
        description: "You don't have the role needed for this action",
        status: 'error',
        isClosable: true,
        position: 'top',
      });
      return;
    }
    try {
      setSubmitting(true);
      const transferTx = await signedRolContract?.cancelTransaction(
        transaction.target,
        transaction.value,
        transaction.signature,
        transaction.data,
        transaction.eta,
      );

      const receipt = await transferTx.wait();

      setSubmitting(false);
      toast({
        title: 'Success',
        description: 'Transaction canceled!',
        status: 'success',
        isClosable: true,
        position: 'top',
      });
    } catch (error) {
      console.log('🚀 ~ file: useFunds.ts ~ line 37 ~ sendFunds ~ error', error);
    }
  };

  const executeTransaction = async (transaction: Transaction) => {
    if (!hasExecutorRole) {
      toast({
        title: 'Error',
        description: "You don't have the role needed for this action",
        status: 'error',
        isClosable: true,
        position: 'top',
      });
      return;
    }
    try {
      setSubmitting(true);
      const transferTx = await signedRolContract?.executeTransaction(
        transaction.target,
        transaction.value,
        transaction.signature,
        transaction.data,
        transaction.eta,
      );
      const receipt = await transferTx.wait();

      setSubmitting(false);
      toast({
        title: 'Success',
        description: 'Transaction executed!',
        status: 'success',
        isClosable: true,
        position: 'top',
      });
    } catch (error) {
      console.log('🚀 ~ file: useFunds.ts ~ line 37 ~ sendFunds ~ error', error);
    }
  };

  const onSubmit = async (formValues: InitialValuesRequestFunds, formikInfo: any) => {
    if (!hasProposerRole) {
      toast({
        title: 'Error',
        description: "You don't have the role needed for this action",
        status: 'error',
        isClosable: true,
        position: 'top',
      });
      return;
    }
    try {
      formikInfo.setSubmitting(true);
      const tokenInterface = new ethers.utils.Interface(TOKEN_JSON.abi);

      const value = ethers.utils.parseEther('0');
      const target = tokenAddress;

      // get timelock delay
      const timelockDelay = await signedTimelockContract?.delay();
      let currentETA = web3 && (await getTransactionEta(Number(timelockDelay), web3));

      const transferSignature = '';
      const transferCallData = tokenInterface.encodeFunctionData('transfer', [
        formValues.address,
        ethers.utils.parseEther(formValues.amount),
      ]);

      const transferTx = await signedRolContract?.queueTransaction(
        target,
        value,
        transferSignature,
        transferCallData,
        currentETA,
        formValues.description,
      );

      const receipt = await transferTx.wait();

      formikInfo.setSubmitting(false);
      formikInfo.resetForm();
      toast({
        title: 'Success',
        description: 'Payment requested!',
        status: 'success',
        isClosable: true,
        position: 'top',
      });
    } catch (error) {
      console.log('🚀 ~ ~ error', error);
    }
  };

  // formik hooks
  const {
    values,
    handleChange,
    submitForm,
    isSubmitting: formSubmitting,
    errors,
    touched,
  } = useFormik({
    initialValues,
    onSubmit,
    validate: RequestPaymentValidationSchema,
  });

  return {
    transactions,
    cancelTransaction,
    executeTransaction,
    values,
    handleChange,
    submitForm,
    isSubmitting: isSubmitting || formSubmitting,
    errors,
    touched,
  };
};
