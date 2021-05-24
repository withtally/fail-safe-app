import { useFormik, FormikErrors, FormikTouched } from "formik";

// common
import { useSignedRolManagerContract } from "modules/common/hooks/useSignedRolManagerContract";
import { useWeb3 } from "modules/common/hooks/useWeb3";

// admin
import { InitialValuesRoles } from "modules/admin/lib/types";

const initialValues: InitialValuesRoles = {
  role: "",
  address: "",
};

type Values = {
  values: InitialValuesRoles;
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
  errors: FormikErrors<InitialValuesRoles>;
  touched: FormikTouched<InitialValuesRoles>;
};

export const useGrantRole = (): Values => {
  // custom hooks
  const { signedContract } = useSignedRolManagerContract();
  const { web3 } = useWeb3();

  // handlers
  const onSubmit = async (formValues: InitialValuesRoles, formikInfo: any) => {
    try {
      formikInfo.setSubmitting(true);
      const transferTx = await signedContract?.grantRole(
        formValues.role,
        formValues.address
      );
      const receipt = await web3.waitForTransaction(transferTx.hash, 3);
      formikInfo.setSubmitting(false);
      formikInfo.resetForm();
    } catch (error) {
      console.log(
        "🚀 ~ file: useFunds.ts ~ line 37 ~ sendFunds ~ error",
        error
      );
    }
  };

  // formik hooks
  const { values, handleChange, submitForm, isSubmitting, errors, touched } =
    useFormik({
      initialValues,
      onSubmit,
    });

  return {
    values,
    handleChange,
    submitForm,
    formSubmitting: isSubmitting,
    errors,
    touched,
  };
};
