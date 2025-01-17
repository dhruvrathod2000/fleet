import React, { useState, useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { push } from "react-router-redux";
import { IQuery } from "interfaces/query";
import { IUser } from "interfaces/user";

// @ts-ignore
import queryActions from "redux/nodes/entities/queries/actions";
// @ts-ignore
import { renderFlash } from "redux/nodes/notifications/actions";

import paths from "router/paths";
import permissionUtils from "utilities/permissions";

import Button from "components/buttons/Button";
import Spinner from "components/loaders/Spinner";
import TableDataError from "components/TableDataError";
import QueriesListWrapper from "./components/QueriesListWrapper";
import RemoveQueryModal from "./components/RemoveQueryModal";

const baseClass = "manage-queries-page";
interface IRootState {
  auth: {
    user: IUser;
  };
  entities: {
    queries: {
      loading: boolean;
      data: IQuery[];
      errors: { name: string; reason: string }[];
    };
  };
}

const renderTable = (
  onRemoveQueryClick: React.MouseEventHandler<HTMLButtonElement>,
  onCreateQueryClick: React.MouseEventHandler<HTMLButtonElement>,
  queriesList: IQuery[],
  queriesErrors: any
): JSX.Element => {
  if (Object.keys(queriesErrors).length > 0) {
    return <TableDataError />;
  }

  return (
    <QueriesListWrapper
      onRemoveQueryClick={onRemoveQueryClick}
      onCreateQueryClick={onCreateQueryClick}
      queriesList={queriesList}
    />
  );
};

const ManageQueriesPage = (): JSX.Element => {
  const currentUser = useSelector((state: IRootState) => state.auth.user);
  const isOnlyObserver = permissionUtils.isOnlyObserver(currentUser);

  const dispatch = useDispatch();
  const { NEW_QUERY } = paths;
  const onCreateQueryClick = () => dispatch(push(NEW_QUERY));

  useEffect(() => {
    dispatch(queryActions.loadAll());
  }, [dispatch]);

  const loadingQueries = useSelector(
    (state: IRootState) => state.entities.queries.loading
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  useEffect(() => {
    setIsLoading(loadingQueries);
  }, [loadingQueries]);
  useEffect(() => {
    setIsLoading(true);
  }, []);

  const queries = useSelector((state: IRootState) => state.entities.queries);
  const queriesList = Object.values(queries.data);
  const queriesErrors = queries.errors;

  const [selectedQueryIds, setSelectedQueryIds] = useState<number[]>([]);
  const [showRemoveQueryModal, setShowRemoveQueryModal] = useState<boolean>(
    false
  );

  const toggleRemoveQueryModal = useCallback(() => {
    setShowRemoveQueryModal(!showRemoveQueryModal);
  }, [showRemoveQueryModal, setShowRemoveQueryModal]);

  const onRemoveQueryClick = (selectedTableQueryIds: any) => {
    toggleRemoveQueryModal();
    setSelectedQueryIds(selectedTableQueryIds);
  };

  const onRemoveQuerySubmit = useCallback(() => {
    const queryOrQueries = selectedQueryIds.length === 1 ? "query" : "queries";

    const promises = selectedQueryIds.map((id: number) => {
      return dispatch(queryActions.destroy({ id }));
    });

    return Promise.all(promises)
      .then(() => {
        dispatch(
          renderFlash("success", `Successfully removed ${queryOrQueries}.`)
        );
        toggleRemoveQueryModal();
        dispatch(queryActions.loadAll());
      })
      .catch((response) => {
        if (
          response.base.slice(0, 47) ===
          "the operation violates a foreign key constraint"
        ) {
          dispatch(
            renderFlash(
              "error",
              `Could not delete query because this query is used as a policy. First remove the policy and then try deleting the query again.`
            )
          );
          dispatch(queryActions.loadAll());
        } else {
          dispatch(
            renderFlash(
              "error",
              `Unable to remove ${queryOrQueries}. Please try again.`
            )
          );
        }
        toggleRemoveQueryModal();
      });
  }, [dispatch, selectedQueryIds, toggleRemoveQueryModal]);

  return (
    <div className={baseClass}>
      <div className={`${baseClass}__wrapper body-wrap`}>
        <div className={`${baseClass}__header-wrap`}>
          <div className={`${baseClass}__header`}>
            <div className={`${baseClass}__text`}>
              <h1 className={`${baseClass}__title`}>
                <span>Queries</span>
              </h1>
              <div className={`${baseClass}__description`}>
                <p>
                  Manage queries to ask specific questions about your devices.
                </p>
              </div>
            </div>
          </div>
          {!isOnlyObserver && queriesList.length > 0 && (
            <div className={`${baseClass}__action-button-container`}>
              <Button
                variant="brand"
                className={`${baseClass}__create-button`}
                onClick={onCreateQueryClick}
              >
                Create new query
              </Button>
            </div>
          )}
        </div>
        <div>
          {!isLoading ? (
            renderTable(
              onRemoveQueryClick,
              onCreateQueryClick,
              queriesList,
              queriesErrors
            )
          ) : (
            <Spinner />
          )}
        </div>
        {showRemoveQueryModal && (
          <RemoveQueryModal
            onCancel={toggleRemoveQueryModal}
            onSubmit={onRemoveQuerySubmit}
          />
        )}
      </div>
    </div>
  );
};

export default ManageQueriesPage;
