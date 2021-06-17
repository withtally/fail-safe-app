import { useState, useEffect } from "react";
import { useFormik, FormikErrors, FormikTouched } from "formik";
import dayjs from "dayjs";
import { ethers } from "ethers";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { useToast } from "@chakra-ui/react";
import { useParams } from "@reach/router";

// common
import { useSignedContract } from "modules/common/hooks/useSignedContract";
import { CONTRACT_ADDRESSES } from "modules/common/lib/constants";
import { useWeb3 } from "modules/common/hooks/useWeb3";
import { useUserInfo } from "modules/common/hooks/useUserInfo";
import { RequestPaymentValidationSchema } from "modules/common/lib/validations";
import { useFundInformation } from "modules/common/hooks/useFundInformation";
import SAFEGUARD_JSON from "modules/common/lib/abis/SafeGuard.json";
import TOKEN_JSON from "modules/common/lib/abis/Comp.json";
import TIMELOCK_JSON from "modules/common/lib/abis/Timelock.json";

// manager
import { InitialValuesRequestFunds } from "modules/manager/lib/types";
import { getTransactionEta } from "modules/manager/lib/helpers";

// admin
import { Transaction } from "modules/admin/lib/types";

dayjs.extend(advancedFormat);

const initialValues: InitialValuesRequestFunds = {
  unitType: "",
  amount: "",
  address: "",
  description: "",
};

type Values = {
  executeTransaction: (transaction: Transaction) => Promise<void>;
  isSubmitting: boolean;
  formSubmitting: boolean;
  values: InitialValuesRequestFunds;
  submitForm: () => Promise<any>;
  handleChange: {
    (e: React.ChangeEvent<any>): void;
    <T_1 = string | React.ChangeEvent<any>>(
      field: T_1
    ): T_1 extends React.ChangeEvent<any>
      ? void
      : (e: string | React.ChangeEvent<any>) => void;
  };
  errors: FormikErrors<InitialValuesRequestFunds>;
  touched: FormikTouched<InitialValuesRequestFunds>;
};

export const usePayments = (): Values => {
  // router hooks
  const { safeGuardAddress } = useParams();

  // react hooks
  const [isSubmitting, setSubmitting] = useState(false);

  // chakra hooks
  const toast = useToast();

  // constants
  const tokenAddress =
    CONTRACT_ADDRESSES.token[process.env.REACT_APP_ETHEREUM_NETWORK];

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
  const { hasExecutorRole, hasProposerRole } = useUserInfo();

  const executeTransaction = async (transaction: Transaction) => {
    if (!hasExecutorRole) {
      toast({
        title: "Error",
        description: "You don't have the role needed for this action",
        status: "error",
        isClosable: true,
        position: "top",
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
        transaction.eta
      );
      const receipt = await web3.waitForTransaction(transferTx.hash, 3);

      setSubmitting(false);
      toast({
        title: "Success",
        description: "Transaction executed!",
        status: "success",
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      console.log(
        "🚀 ~ file: useFunds.ts ~ line 37 ~ sendFunds ~ error",
        error
      );
    }
  };

  const onSubmit = async (
    formValues: InitialValuesRequestFunds,
    formikInfo: any
  ) => {
    if (!hasProposerRole) {
      toast({
        title: "Error",
        description: "You don't have the role needed for this action",
        status: "error",
        isClosable: true,
        position: "top",
      });
      return;
    }
    try {
      formikInfo.setSubmitting(true);
      const tokenInterface = new ethers.utils.Interface(TOKEN_JSON.abi);

      const value = ethers.utils.parseEther("0");
      const target = tokenAddress;

      // get timelock delay
      const timelockDelay = await signedTimelockContract?.delay();
      let currentETA = await getTransactionEta(Number(timelockDelay), web3);

      const transferSignature = "";
      const transferCallData = tokenInterface.encodeFunctionData("transfer", [
        formValues.address,
        ethers.utils.parseEther(formValues.amount),
      ]);

      const transferTx =
        await signedRolContract?.queueTransactionWithDescription(
          target,
          value,
          transferSignature,
          transferCallData,
          currentETA,
          formValues.description
        );

      const receipt = await web3.waitForTransaction(transferTx.hash, 3);

      formikInfo.setSubmitting(false);
      formikInfo.resetForm();
      toast({
        title: "Success",
        description: "Payment requested!",
        status: "success",
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      console.log("🚀 ~ ~ error", error);
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
    executeTransaction,
    values,
    handleChange,
    submitForm,
    isSubmitting: isSubmitting,
    formSubmitting: formSubmitting,
    errors,
    touched,
  };
};
