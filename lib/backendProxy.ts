export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Endpoints del backend que el panel puede usar. El resto (sync, suscripciones, borrados masivos) no se expone. */
const ALLOWED_ENDPOINTS: Record<string, readonly Method[]> = {
    "gif/getInteractions": ["GET"],
    "gif/getInteractionByName": ["GET"],
    "gif/addGif": ["POST"],
    "gif/editGif": ["PUT"],
    "gif/deleteGif": ["DELETE"],
    "birthday/setup": ["GET", "PUT"],
    "birthday/setup-card": ["GET", "POST", "PUT"],
    "joinServer/setup": ["GET", "POST", "PUT"],
    "joinServer/setup-card": ["GET", "POST", "PUT"],
    "customCommand": ["GET", "POST"],
    "customCommand/preview": ["POST"],
    "customCommand/:id": ["PUT", "DELETE"],
    "customCommand/:id/status": ["PATCH"],
    "channelRule": ["GET", "POST"],
    "channelRule/:id": ["PUT", "DELETE"],
    "channelRule/:id/enabled": ["PATCH"],
    "scheduledTask": ["GET", "POST"],
    "scheduledTask/:id": ["PUT", "DELETE"],
    "scheduledTask/:id/status": ["PATCH"],
    "autoCleanMessage": ["GET", "POST"],
    "autoCleanMessage/:id": ["PUT", "DELETE"],
    "autoCleanMessage/:id/status": ["PATCH"],
    "ghostMessage": ["GET", "POST"],
    "ghostMessage/:id": ["PUT", "DELETE"],
    "ghostMessage/:id/status": ["PATCH"],
};

/**
 * Recursos cuyas operaciones por id el proxy solo reenvía si el id aparece en el listado de ESTE
 * servidor: el bot no lo verifica en PUT/PATCH/DELETE.
 */
const OWNERSHIP_CHECKED_RESOURCES = ["autoCleanMessage", "ghostMessage"];

/** Endpoints cuyo cuerpo el bot exige exacto (`{ enabled }`): el `serverId` va solo en la query. */
const BODY_WITHOUT_SERVER_ID = new Set(["autoCleanMessage/:id/status", "ghostMessage/:id/status"]);

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/;

/** Convierte `customCommand/<objectId>/status` en la clave `customCommand/:id/status`. */
export function endpointKey(path: string[]): string {
    return path.map((segment, index) => (index > 0 && OBJECT_ID_PATTERN.test(segment) ? ":id" : segment)).join("/");
}

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

export function isAllowedEndpoint(path: string[], method: Method): boolean {
    return ALLOWED_ENDPOINTS[endpointKey(path)]?.includes(method) ?? false;
}

export function isSnowflake(value: string): boolean {
    return SNOWFLAKE_PATTERN.test(value);
}

/** URL hacia el bot: conserva la query del cliente pero el `serverId` siempre es el de la ruta. */
export function forwardUrl(base: string, path: string[], clientQuery: URLSearchParams, serverId: string): URL {
    const url = new URL(`${base}/${path.join("/")}`);
    clientQuery.forEach((value, key) => url.searchParams.append(key, value));
    url.searchParams.set("serverId", serverId);
    return url;
}

/** Cuerpo hacia el bot: el `serverId` que mande el cliente se descarta y se fija el de la ruta. */
export function forwardBody(path: string[], json: Record<string, unknown>, serverId: string): Record<string, unknown> {
    const rest = { ...json };
    delete rest.serverId;
    return BODY_WITHOUT_SERVER_ID.has(endpointKey(path)) ? rest : { ...rest, serverId };
}

/** Recurso e id a verificar antes de reenviar una operación por id, o null si no aplica. */
export function ownershipCheckFor(path: string[]): { resource: string; id: string } | null {
    const [resource, id] = path;
    if (!OWNERSHIP_CHECKED_RESOURCES.includes(resource) || !id || !OBJECT_ID_PATTERN.test(id)) return null;
    return { resource, id };
}

/** Recursos con límite por plan: endpoint del backend, límite en PLAN_LIMITS y textos. */
export const LIMITED_RESOURCES = {
    customCommand: { limit: "customCommands", total: "comandos personalizados", active: "comandos activos", toggle: "status" },
    channelRule: { limit: "channelRules", total: "reglas de canal", active: "reglas activas", toggle: "enabled" },
} as const;

export type LimitedResource = keyof typeof LIMITED_RESOURCES;

/** Qué controla el límite del plan para este pedido: crear o activar un recurso limitado. */
export function limitCheckFor(method: Method, path: string[], body: string | undefined) {
    const [resource, id, toggle] = path;
    if (!(resource in LIMITED_RESOURCES)) return null;
    const config = LIMITED_RESOURCES[resource as LimitedResource];
    const enabling = JSON.parse(body ?? "{}").enabled === true;
    if (method === "POST" && path.length === 1) return { resource: resource as LimitedResource, action: "create" as const };
    if (method === "PATCH" && toggle === config.toggle && enabling) return { resource: resource as LimitedResource, action: "activate" as const, id };
    if (method === "PUT" && path.length === 2 && enabling) return { resource: resource as LimitedResource, action: "activate" as const, id };
    return null;
}
