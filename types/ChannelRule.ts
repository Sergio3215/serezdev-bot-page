export type LinkType = "youtube" | "x" | "instagram" | "twitch" | "kick" | "https";
export type LinkRuleMode = "contains" | "linksOnly";

export interface ChannelRule {
    id: string;
    serverId: string;
    channelId: string;
    type: "linkRestriction";
    allowedTypes: LinkType[];
    mode: LinkRuleMode;
    enabled: boolean;
}

export interface ChannelRuleInput {
    channelId: string;
    type: "linkRestriction";
    allowedTypes: LinkType[];
    mode: LinkRuleMode;
}
