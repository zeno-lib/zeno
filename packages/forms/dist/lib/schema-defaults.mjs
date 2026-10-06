//#region src/lib/schema-defaults.ts
const MAX_WRAPPER_DEPTH = 16;
function getDef(node) {
	return node?._zod?.def;
}
function extractDefaultForField(node) {
	let current = node;
	for (let depth = 0; depth < MAX_WRAPPER_DEPTH; depth++) {
		const def = getDef(current);
		if (!def?.type) return { ok: false };
		switch (def.type) {
			case "default":
			case "prefault": return {
				ok: true,
				value: def.defaultValue
			};
			case "optional":
			case "nullable":
			case "nonoptional":
			case "readonly":
				current = def.innerType;
				continue;
			case "pipe":
				current = def.in;
				continue;
			case "string": return {
				ok: true,
				value: ""
			};
			case "array": return {
				ok: true,
				value: []
			};
			case "object": {
				const nested = current ? extractZodDefaults(current) : {};
				return Object.keys(nested).length > 0 ? {
					ok: true,
					value: nested
				} : { ok: false };
			}
			default: return { ok: false };
		}
	}
	return { ok: false };
}
function extractZodDefaults(schema) {
	try {
		const def = getDef(schema);
		if (def?.type !== "object" || !def.shape) return {};
		const result = {};
		for (const [key, field] of Object.entries(def.shape)) {
			const extracted = extractDefaultForField(field);
			if (extracted.ok) result[key] = extracted.value;
		}
		return result;
	} catch {
		return {};
	}
}
function isPlainObject(value) {
	return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
function deepMergeDefaults(schemaDefaults, userDefaults) {
	if (!userDefaults) return schemaDefaults;
	const result = { ...schemaDefaults };
	for (const key of Object.keys(userDefaults)) {
		const userValue = userDefaults[key];
		const schemaValue = schemaDefaults[key];
		if (isPlainObject(schemaValue) && isPlainObject(userValue)) result[key] = deepMergeDefaults(schemaValue, userValue);
		else result[key] = userValue;
	}
	return result;
}
//#endregion
export { deepMergeDefaults, extractZodDefaults };
