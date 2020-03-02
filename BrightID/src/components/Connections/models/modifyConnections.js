// @flow

import api from '../../../Api/BrightId';
import { deleteConnection } from '../../../actions';
import { fakeJoinGroups } from '../../../actions/fakeGroup';

const flagAndDeleteConnection = (connection, reason) => async () => {
  try {
    const { dispatch, id } = connection;
    console.log('reason', reason);
    await api.removeConnection(id, reason);
    // remove connection from redux
    dispatch(deleteConnection(id));
  } catch (err) {
    err instanceof Error ? console.warn(err.message) : console.log(err);
  }
};

const fakeJoinAllGs = (connection) => async () => {
  const { dispatch, id, secretKey } = connection;
  dispatch(fakeJoinGroups({ id, secretKey }));
};

export const performAction = (
  action,
  connection,
): ({ handler: () => void, title: string, msg: string }) => {
  const { name } = connection;
  switch (action) {
    case 'Flag as Duplicate':
    case 'Flag as Fake':
    case 'Flag as Diseased': {
      let handler = flagAndDeleteConnection(
        connection,
        action.split(' as ')[1].toLowerCase(),
      );
      let title = 'Flag and Delete Connection';
      let reason = action.split(' as ')[1];
      let msg = `Are you sure you want to flag ${name} as ${reason} and remove the connection?`;
      return { handler, title, msg };
    }
    case 'Join All Groups': {
      let handler = fakeJoinAllGs(connection);
      let title = 'Join Groups';
      let msg = `Are you sure you want to join all groups`;
      return { handler, title, msg };
    }
    default: {
      return { handler: () => null, title: '', msg: '' };
    }
  }
};
