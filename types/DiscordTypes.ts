export interface DiscordUser {
    id: string;
    username: string;
    avatar: string | null;
    discriminator: string;
    global_name?: string | null;
}

export interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
}

export interface serverList {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filteredGuilds: DiscordGuild[];
    loadingGuilds: boolean;
    getInitials: (name: string) => string;
    getGuildIconUrl: (guild: DiscordGuild) => string | null;
}

export type currentUser = {
    user: DiscordUser;
    displayName: string;
    handleLogout: () => Promise<void>;
    getAvatarUrl: (u: DiscordUser) => string;
    loggingOut: boolean;
}

export interface serverSelect {
    filteredGuilds: DiscordGuild[];
}

export interface DiscordRole {
    id: string;
    name: string;
    color: string;
    position: number;
    assignable: boolean;
}

export interface roleDropdownType {
    roles: DiscordRole[];
    value: string;
    onChange: (roleId: string) => void;
    disabled?: boolean;
    loading?: boolean;
    error?: string | null;
}

export interface DiscordChannel {
    id: string;
    name: string;
    /** 0 = texto, 5 = anuncios */
    type: number;
    categoryName: string | null;
    /** false cuando al bot le falta ver el canal, escribir o adjuntar archivos. */
    canSend: boolean;
}

export interface channelDropdownType {
    channels: DiscordChannel[];
    value: string | null;
    onChange: (channelId: string) => void;
    disabled?: boolean;
    loading?: boolean;
    error?: string | null;
}
