import { useState, useEffect } from "react";
import { useFormik, FormikErrors, FormikTouched } from "formik";
import dayjs from "dayjs";
import { ethers } from "ethers";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { useToast } from "@chakra-ui/react";

// common
import { useSignedContract } from "modules/common/hooks/useSignedContract";
import { CONTRACT_ADDRESSES } from "modules/common/lib/constants";
import { useWeb3 } from "modules/common/hooks/useWeb3";
import REGISTRY_JSON from "modules/common/lib/abis/Registry.json";
import FACTORY_JSON from "modules/common/lib/abis/Factory.json";

// failSafe
import {
  InitialValuesCreateFailSafe,
  FailSafe,
} from "modules/failSafe/lib/types";
import { CreateFailSafeValidationSchema } from "modules/failSafe/lib/validations";
import { parseFailSafeCreations } from "modules/failSafe/lib/parsers/parseFailSafeCreations";

dayjs.extend(advancedFormat);

const initialValues: InitialValuesCreateFailSafe = {
  delay: "",
  safeName: "",
};

type Values = {
  createdSafes?: FailSafe[];
  values: InitialValuesCreateFailSafe;
  submitForm: () => Promise<any>;
  handleChange: {
    (e: React.ChangeEvent<any>): void;
    <T_1 = string | React.ChangeEvent<any>>(
      field: T_1
    ): T_1 extends React.ChangeEvent<any>
      ? void
      : (e: string | React.ChangeEvent<any>) => void;
  };
  formSubmitting: boolean;
  errors: FormikErrors<InitialValuesCreateFailSafe>;
  touched: FormikTouched<InitialValuesCreateFailSafe>;
};

export const useFailSafe = (): Values => {
  // react hooks
  const [registries, setRegistries] = useState<FailSafe[]>();

  // chakra hooks
  const toast = useToast();

  // constants
  const registryAddress = CONTRACT_ADDRESSES.registry.rinkeby;
  const factoryAddress = CONTRACT_ADDRESSES.factory.rinkeby;

  // custom hook
  const { signedContract: signedRegistryContract } = useSignedContract({
    contractAddress: registryAddress,
    contractAbi: REGISTRY_JSON.abi,
  });
  const { signedContract: signedFactoryContract } = useSignedContract({
    contractAddress: factoryAddress,
    contractAbi: FACTORY_JSON.abi,
  });
  const { web3 } = useWeb3();

  const getRegistries = async () => {
    try {
      const createdSafesEventFilter =
        await signedFactoryContract?.filters.RolManagerCreated();
      const createdSafes = await signedFactoryContract?.queryFilter(
        createdSafesEventFilter
      );

      const createdSafesInfo = createdSafes?.map(
        (item) => item.args && parseFailSafeCreations(item.args)
      );

      const allCreatedSafes = createdSafesInfo.map((item) => {
        if (item) {
          return {
            ...item,
          };
        }
      }) as FailSafe[];

      setRegistries(allCreatedSafes);
    } catch (error) {
      console.log(
        "🚀 ~ file: useRegistry.ts ~ line 73 ~ getRegistries ~ error",
        error
      );
    }
  };

  useEffect(() => {
    if (signedRegistryContract) getRegistries();
  }, []);

  const onSubmit = async (
    formValues: InitialValuesCreateFailSafe,
    formikInfo: any
  ) => {
    try {
      formikInfo.setSubmitting(true);

      const transferTx = await signedFactoryContract?.createFailSafe(
        formValues.delay,
        formValues.safeName
      );

      const receipt = await web3.waitForTransaction(transferTx.hash, 3);

      formikInfo.setSubmitting(false);
      formikInfo.resetForm();
      toast({
        title: "Success",
        description: "FailSafe created!",
        status: "success",
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      console.log(
        "🚀 ~ file: useRegistry.ts ~ line 108 ~ onSubmit ~ error",
        error
      );
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
    validate: CreateFailSafeValidationSchema,
  });

  return {
    createdSafes: registries,
    values,
    handleChange,
    submitForm,
    formSubmitting,
    errors,
    touched,
  };
};
