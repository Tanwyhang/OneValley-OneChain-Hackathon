import { useSuiClientQuery } from '@onelabs/dapp-kit';
 
function GetObject() {
const { data, isPending, isError, error, refetch } = useSuiClientQuery(
'getOwnedObjects',
{ owner: '0x123' },
{
gcTime: 10000,
},
);
 
if (isPending) {
return <div>Loading...</div>;
}
 
if (isError) {
return <div>Error: {error.message}</div>;
}
 
return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

export default GetObject;