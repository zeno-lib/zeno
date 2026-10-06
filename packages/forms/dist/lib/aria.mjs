//#region src/lib/aria.ts
function describedBy(...entries) {
	const ids = entries.filter(([show]) => Boolean(show)).map(([, id]) => id);
	return ids.length > 0 ? ids.join(" ") : void 0;
}
//#endregion
export { describedBy };
