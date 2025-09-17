
const { encryptedObject: encryptedBytes, key: backupKey } = await client.encrypt({
    threshold: 2,
    packageId: fromHEX(packageId),
    id: fromHEX(id),
    data,
});