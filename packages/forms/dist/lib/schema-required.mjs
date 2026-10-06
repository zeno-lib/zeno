//#region src/lib/schema-required.ts
const MAX_PROBE_DEPTH = 8;
const INDEX_SEGMENT = /^\d+$/;
const INDEX_IN_NAME = /\[\d+\]|\.(\d+)(?=\.|\[|$)/g;
function pathKey(part) {
	if (typeof part === "object" && part !== null && "key" in part) return part.key;
	return part;
}
function isIndex(key) {
	return typeof key === "number" || typeof key === "string" && INDEX_SEGMENT.test(key);
}
function joinPath(keys) {
	let out = "";
	for (const key of keys) if (isIndex(key)) out += "[0]";
	else out += out === "" ? String(key) : `.${String(key)}`;
	return out;
}
/**
* Normalise a field name (`members[3].name` or `members.3.name`) to the key
* `getRequiredPaths` records (`members[0].name`).
*/
function toRequiredPathKey(name) {
	return name.replace(INDEX_IN_NAME, "[0]");
}
function probeContainer(expected) {
	if (typeof expected !== "string") return;
	const kind = expected.toLowerCase();
	if (kind === "object") return {};
	if (kind === "array") return [{}];
}
function fillAt(root, keys, value) {
	let node = root;
	for (const key of keys.slice(0, -1)) {
		const next = node[key];
		if (typeof next !== "object" || next === null) return false;
		node = next;
	}
	const last = keys.at(-1);
	if (node[last] !== void 0) return false;
	node[last] = value;
	return true;
}
function validateSync(schema, value) {
	let result;
	try {
		result = schema["~standard"].validate(value);
	} catch {
		return;
	}
	if (result instanceof Promise) return;
	return "issues" in result && result.issues ? result.issues : [];
}
function getRequiredPaths(schema) {
	const required = /* @__PURE__ */ new Set();
	const probe = {};
	for (let depth = 0; depth < MAX_PROBE_DEPTH; depth++) {
		const issues = validateSync(schema, probe);
		if (!issues) return required;
		let descended = false;
		for (const issue of issues) {
			const keys = issue.path?.map(pathKey) ?? [];
			if (keys.length === 0) continue;
			required.add(joinPath(keys));
			const container = probeContainer(issue.expected);
			if (container !== void 0 && fillAt(probe, keys, container)) descended = true;
		}
		if (!descended) break;
	}
	return required;
}
//#endregion
export { getRequiredPaths, toRequiredPathKey };
