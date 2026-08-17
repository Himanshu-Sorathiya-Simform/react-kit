/** Shared default so unobserved hooks don't allocate a fresh empty array per render. */
const EMPTY_RECORDS: MutationRecord[] = [];

export { EMPTY_RECORDS };
