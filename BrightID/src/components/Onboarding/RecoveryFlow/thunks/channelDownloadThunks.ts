import ChannelAPI from '@/api/channelService';
import { saveImage } from '@/utils/filesystem';
import { decryptData } from '@/utils/cryptoHelper';
import { hash } from '@/utils/encoding';
import { addConnection, createGroup } from '@/actions';
import {
  increaseRecoveredConnections,
  increaseRecoveredGroups,
  setSig,
  updateNamePhoto,
} from '../recoveryDataSlice';

export const loadRecoveryData = async (
  channelApi: ChannelAPI,
  aesKey: string,
): Promise<{ signingKey: string; timestamp: number }> => {
  try {
    const data = await channelApi.download({
      channelId: hash(aesKey),
      dataId: 'data',
    });
    if (!data.signingKey || !data.timestamp) {
      throw new Error(
        'Please ask the connection to reload their QR code and try again',
      );
    } else {
      return data;
    }
  } catch (err) {
    throw new Error('Bad QR Data');
  }
};

const downloadConnection = async ({
  dataId,
  channelApi,
  aesKey,
  channelId,
}: {
  dataId: string;
  channelApi: ChannelAPI;
  aesKey: string;
  channelId: string;
}) => {
  try {
    const encrypted = await channelApi.download({ channelId, dataId });
    const connectionData = decryptData(encrypted, aesKey);

    // missing data
    if (!connectionData || !connectionData?.id || !connectionData?.name) {
      console.log('missing connection data');
      return;
    }

    console.log(`Downloading profile data of ${connectionData?.id} ...`);

    let filename;
    if (connectionData.photo) {
      filename = await saveImage({
        imageName: connectionData.id,
        base64Image: connectionData.photo,
      });
    }
    connectionData.photo = { filename };

    return connectionData;
  } catch (err) {
    console.error(`downloadConnection: ${err.message}`);
  }
};

export const downloadConnections = ({
  channelApi,
  dataIds,
}: {
  channelApi: ChannelAPI;
  dataIds: Array<string>;
}) => async (dispatch: dispatch, getState: getState) => {
  try {
    const {
      recoveryData: {
        id: recoveryId,
        aesKey,
        channel: { channelId },
      },
      connections: { connections },
    } = getState();

    const existingConnIds = connections.map((c) => c.id);

    const isConn = (id) => id.startsWith('connection_');
    const connId = (id) => id.replace('connection_', '');

    const connectionDataIds = dataIds.filter(
      (id) =>
        isConn(id) &&
        !existingConnIds.includes(connId(id)) &&
        connId(id) !== recoveryId,
    );

    let count = 0;
    for (const dataId of connectionDataIds) {
      const connectionData = await downloadConnection({
        dataId,
        channelApi,
        aesKey,
        channelId,
      });
      if (connectionData) {
        dispatch(addConnection(connectionData));
        count++;
      }
    }
    if (count > 0) {
      dispatch(increaseRecoveredConnections({ count }));
    }
    return connectionDataIds.length;
  } catch (err) {
    console.error(`downloadingConnections: ${err.message}`);
  }
};

export const downloadNamePhoto = ({
  channelApi,
  dataIds,
}: {
  channelApi: ChannelAPI;
  dataIds: Array<string>;
}) => async (dispatch: dispatch, getState: getState) => {
  const {
    recoveryData: {
      id: recoveryId,
      aesKey,
      channel: { channelId },
    },
  } = getState();

  const connId = (id) => id.replace('connection_', '');

  const dataId = dataIds.find((id) => connId(id) === recoveryId);

  if (dataId) {
    const connectionData = await downloadConnection({
      dataId,
      channelApi,
      aesKey,
      channelId,
    });

    const {
      recoveryData: { name },
    } = getState();

    if (!name && connectionData) {
      dispatch(updateNamePhoto(connectionData));
    }
  }
};

const downloadGroup = async ({
  dataId,
  channelApi,
  aesKey,
  channelId,
}: {
  dataId: string;
  channelApi: ChannelAPI;
  aesKey: string;
  channelId: string;
}) => {
  try {
    const encrypted = await channelApi.download({ channelId, dataId });
    const groupData = decryptData(encrypted, aesKey);
    // group data missing
    if (!groupData || !groupData?.id || !groupData?.aesKey) {
      console.log('missing group data');
      return;
    }

    let filename;
    if (groupData.photo) {
      filename = await saveImage({
        imageName: groupData.id,
        base64Image: groupData.photo,
      });
    }
    groupData.photo = { filename };
    return groupData;
  } catch (err) {
    console.error(`downloadGroup: ${err.message}`);
  }
};

export const downloadGroups = ({
  channelApi,
  dataIds,
}: {
  channelApi: ChannelAPI;
  dataIds: Array<string>;
}) => async (dispatch: dispatch, getState: getState) => {
  try {
    const {
      recoveryData: {
        aesKey,
        channel: { channelId },
      },
      groups: { groups },
    } = getState();

    const existingGroupIds = groups.map((c) => c.id);

    const isGroup = (id) => id.startsWith('group_');
    const groupId = (id) => id.replace('group_', '');

    const groupDataIds = dataIds.filter(
      (id) => isGroup(id) && !existingGroupIds.includes(groupId(id)),
    );

    let count = 0;
    for (const dataId of groupDataIds) {
      const groupData = await downloadGroup({
        dataId,
        channelApi,
        aesKey,
        channelId,
      });
      if (groupData) {
        dispatch(createGroup(groupData));
        count++;
      }
    }
    if (count > 0) {
      dispatch(increaseRecoveredGroups({ count }));
    }
    return groupDataIds.length;
  } catch (err) {
    console.error(`downloadingGroups: ${err.message}`);
  }
};

export const downloadSigs = ({
  channelApi,
  dataIds,
}: {
  channelApi: ChannelAPI;
  dataIds: Array<string>;
}) => async (dispatch: dispatch, getState: getState) => {
  try {
    const {
      recoveryData: {
        sigs,
        channel: { channelId },
      },
    } = getState();

    const isSig = (id) => id.startsWith('sig_');
    const sigId = (id) => id.replace('sig_', '');

    const sigDataIds = dataIds.filter((id) => isSig(id) && !sigs[sigId(id)]);

    for (const dataId of sigDataIds) {
      const signer = sigId(dataId);
      const sig = await channelApi.download({ channelId, dataId });
      dispatch(setSig({ signer, sig }));
    }
    return sigDataIds.length;
  } catch (err) {
    console.error(`downloadingSigs: ${err.message}`);
  }
};
