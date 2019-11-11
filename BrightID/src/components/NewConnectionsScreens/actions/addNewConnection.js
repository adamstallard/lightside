// @flow

import nacl from 'tweetnacl';
import { AsyncStorage } from 'react-native';
import { createCipher } from 'react-native-crypto';
import emitter from '../../../emitter';
import { saveImage } from '../../../utils/filesystem';
import {
  b64ToUrlSafeB64,
  strToUint8Array,
  uInt8ArrayToB64,
} from '../../../utils/encoding';
import { encryptAndUploadLocalData } from './encryptData';
import api from '../../../Api/BrightId';
import { saveConnection } from '../../../actions/connections';
import backupApi from '../../../Api/BackupApi';

export const addNewConnection = () => async (
  dispatch: dispatch,
  getState: getState,
) => {
  /**
   * Add connection in async storage  &&
   * Clear the redux store of all leftoverwebrtc data
   */
  try {
    const {
      connectUserData,
      publicKey,
      secretKey,
      backupCompleted,
      name,
      score,
      safePubKey,
      connections
    } = getState().main;
    let connectionDate = Date.now();

    if (connectUserData.signedMessage) {
      // The other user signed a connection request; we have enough info to
      // make an API call to create the connection.

      const message =
        connectUserData.publicKey + publicKey + connectUserData.timestamp;
      const signedMessage = uInt8ArrayToB64(
        nacl.sign.detached(strToUint8Array(message), secretKey),
      );
      await api.createConnection(
        connectUserData.publicKey,
        connectUserData.signedMessage,
        publicKey,
        signedMessage,
        connectUserData.timestamp,
      );
    } else {
      // We will sign a connection request and upload it. The other user will
      // make the API call to create the connection.

      dispatch(encryptAndUploadLocalData());
    }
    // We store publicKeys as url-safe base-64.
    const connectUserSafePubKey = b64ToUrlSafeB64(connectUserData.publicKey);

    if (connectUserData.oldKeys) {
      AsyncStorage.multiRemove(connectUserData.oldKeys);
    }

    const filename = await saveImage({
      imageName: connectUserSafePubKey,
      base64Image: connectUserData.photo,
    });

    const connectionData = {
      publicKey: connectUserSafePubKey,
      name: connectUserData.name,
      score: connectUserData.score,
      secretKey: connectUserData.secretKey,
      connectionDate,
      photo: { filename },
    };

    // first backup the connection because if we save the connection first
    // and then we get an error in saving the backup, user will not solve
    // the issue by making the connection again.
    if (backupCompleted) {
      const password = await AsyncStorage.getItem('password');
      let cipher = createCipher('aes128', password);
      let encrypted = cipher.update(connectUserData.photo, 'utf8', 'base64') + cipher.final('base64');
      await backupApi.set(safePubKey, connectUserSafePubKey, encrypted);
      const userData = { publicKey, safePubKey, name, score };
      const tmp = [...connections, connectionData];
      const dataStr = JSON.stringify({userData, connections: tmp});
      cipher = createCipher('aes128', password);
      encrypted = cipher.update(dataStr, 'utf8', 'base64') + cipher.final('base64');
      await backupApi.set(safePubKey, 'data', encrypted);
      console.log('new connection backup completed!');
    }
    

    // add connection inside of async storage
    await saveConnection(connectionData);

    emitter.emit('refreshConnections', {});
  } catch (err) {
    console.log(err);
  }
};
