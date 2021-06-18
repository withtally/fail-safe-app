import { useState, useEffect } from 'react';
import { FormikHelpers } from 'formik';
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import { useToast } from '@chakra-ui/react';

// common
import { useSignedContract } from 'modules/common/hooks/useSignedContract';
import { CONTRACT_ADDRESSES } from 'modules/common/lib/constants';
import { useWeb3 } from 'modules/common/hooks/useWeb3';
import FACTORY_JSON from 'modules/common/lib/abis/Factory.json';

// safeGuard
import { InitialValuesCreateSafeGuard, SafeGuard } from 'modules/safeGuard/lib/types';
import { parseSafeGuardCreations } from 'modules/safeGuard/lib/parsers/parseSafeGuardCreations';

dayjs.extend(advancedFormat);

const initialValues: InitialValuesCreateSafeGuard = {
  delay: '',
  safeGuardName: '',
  rolesAssignations: [],
};

type Values = {
  createdSafes?: SafeGuard[];
  initialValues: InitialValuesCreateSafeGuard;
  formSubmit: (
    formValues: InitialValuesCreateSafeGuard,
    actions: FormikHelpers<InitialValuesCreateSafeGuard>,
  ) => Promise<void>;
};

export const useSafeGuard = (): Values => {
  // react hooks
  const [registries, setRegistries] = useState<SafeGuard[]>();

  // chakra hooks
  const toast = useToast();

  // constants
  const factoryAddress = CONTRACT_ADDRESSES.factory[process.env.REACT_APP_ETHEREUM_NETWORK];

  // custom hook
  const { signedContract: signedFactoryContract } = useSignedContract({
    contractAddress: factoryAddress,
    contractAbi: FACTORY_JSON.abi,
  });
  const { web3, signerAddress } = useWeb3();

  const getRegistries = async () => {
    try {
      const createdSafesEventFilter = await signedFactoryContract?.filters.SafeGuardCreated();
      const createdSafes =
        createdSafesEventFilter &&
        (await signedFactoryContract?.queryFilter(createdSafesEventFilter));

      const createdSafesInfo = createdSafes?.map(
        (item) => item.args && parseSafeGuardCreations(item.args),
      );

      const allCreatedSafes = createdSafesInfo?.map((item) => {
        if (item) {
          return {
            ...item,
          };
        }
      }) as SafeGuard[];

      setRegistries(allCreatedSafes);
    } catch (error) {
      console.log('🚀 ~  ~ error', error);
    }
  };

  useEffect(() => {
    if (signedFactoryContract) getRegistries();
  }, []);

  useEffect(() => {
    if (!signedFactoryContract) return;

    signedFactoryContract.on('SafeGuardCreated', (event) => {
      getRegistries();
    });

    return () => {
      signedFactoryContract.removeAllListeners('SafeGuardCreated');
    };
  });

  const formSubmit = async (
    formValues: InitialValuesCreateSafeGuard,
    actions: FormikHelpers<InitialValuesCreateSafeGuard>,
  ) => {
    try {
      actions.setSubmitting(true);

      const roles = formValues.rolesAssignations.map(({ role }) => role);
      const rolesAssignees = formValues.rolesAssignations.map(({ address }) => address);

      const transferTx = await signedFactoryContract?.createSafeGuard(
        formValues.delay,
        formValues.safeGuardName,
        signerAddress,
        roles,
        rolesAssignees,
      );

      const receipt = await web3?.waitForTransaction(transferTx.hash, 3);

      actions.setSubmitting(false);
      actions.resetForm();
      toast({
        title: 'Success',
        description: 'SafeGuard created!',
        status: 'success',
        isClosable: true,
        position: 'top',
      });
    } catch (error) {
      console.log('🚀 ~  error', error);
    }
  };

  return {
    createdSafes: registries,
    initialValues,
    formSubmit,
  };
};
