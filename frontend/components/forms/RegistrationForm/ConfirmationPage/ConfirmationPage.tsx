import React, { useEffect } from "react";
import classnames from "classnames";

import Button from "components/buttons/Button";
import { IRegistrationFormData } from "interfaces/registration_form_data";
import Checkbox from "components/forms/fields/Checkbox";

const baseClass = "confirm-user-reg";

interface IConfirmationPageProps {
  className: string;
  currentPage: boolean;
  formData: IRegistrationFormData;
  handleSubmit: any; // TODO: meant to be an event; figure out type for this
}

const ConfirmationPage = ({
  className,
  currentPage,
  formData,
  handleSubmit,
}: IConfirmationPageProps) => {
  useEffect(() => {
    if (currentPage) {
      // Component has a transition duration of 300ms set in
      // RegistrationForm/_styles.scss. We need to wait 300ms before
      // calling .focus() to preserve smooth transition.
      setTimeout(() => {
        // wanted to use React ref here instead of class but ref is already used
        // in Button.tsx, which could break other button uses
        const confirmationButton = document.querySelector(
          `.${baseClass} button.button--brand`
        ) as HTMLElement;
        confirmationButton?.focus();
      }, 300);
    }
  }, [currentPage]);

  const importOsqueryConfig = () => {
    const disableImport = true;

    if (disableImport) {
      return false;
    }

    return (
      <div className={`${baseClass}__import`}>
        <Checkbox name="import-install">
          <p>
            I am migrating an existing <strong>osquery</strong> installation.
          </p>
          <p>
            Take me to the <strong>Import Configuration</strong> page.
          </p>
        </Checkbox>
      </div>
    );
  };

  const {
    email,
    fleet_web_address: fleetWebAddress,
    org_name: orgName,
    username,
  } = formData;
  const tabIndex = currentPage ? 1 : -1;

  const confirmRegClasses = classnames(className, baseClass);

  return (
    <form onSubmit={handleSubmit} className={confirmRegClasses}>
      <div className={`${baseClass}__wrapper`}>
        <table className={`${baseClass}__table`}>
          <caption>Administrator configuration</caption>
          <tbody>
            <tr>
              <th>Username:</th>
              <td>{username}</td>
            </tr>
            <tr>
              <th>Email:</th>
              <td>{email}</td>
            </tr>
            <tr>
              <th>Organization:</th>
              <td>{orgName}</td>
            </tr>
            <tr>
              <th>Fleet URL:</th>
              <td>
                <span
                  className={`${baseClass}__table-url`}
                  title={fleetWebAddress}
                >
                  {fleetWebAddress}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {importOsqueryConfig()}
      </div>

      <Button
        type="submit"
        tabIndex={tabIndex}
        disabled={!currentPage}
        className="button button--brand"
      >
        Finish
      </Button>
    </form>
  );
};

export default ConfirmationPage;