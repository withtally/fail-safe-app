import { FC } from "react";
import { Flex } from "@chakra-ui/react";

// common
import PageHeader from "modules/common/components/PageHeader";

// failSafe
import SafeGuardList from "modules/safeGuard/components/SafeGuardList";
import CreateSafeGuard from "modules/safeGuard/components/CreateSafeGuard";
import { useSafeGuard } from "modules/safeGuard/hooks/useSafeGuard";

const SafeGuard: FC = () => {
  // custom hooks
  const {
    createdSafes,
    handleChange,
    values,
    submitForm,
    formSubmitting,
    errors,
    touched,
  } = useSafeGuard();
  return (
    <Flex direction="column" w="full">
      <PageHeader title="Created SafeGuards" />
      <CreateSafeGuard
        values={values}
        errors={errors}
        touched={touched}
        submitForm={submitForm}
        handleChange={handleChange}
        formSubmitting={formSubmitting}
      />
      <SafeGuardList safeList={createdSafes} />
    </Flex>
  );
};

export default SafeGuard;