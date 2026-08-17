import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';
import type {
  AccessProfile,
  CustomFieldDef,
  Label,
  Permission,
  Profile,
  Space,
  SpaceMember,
} from '@/types';

interface SpaceCtx {
  space: Space | null;
  members: SpaceMember[];
  accessProfiles: AccessProfile[];
  labels: Label[];
  fieldDefs: CustomFieldDef[];
  profileMap: Map<string, Profile>;
  labelMap: Map<string, Label>;
  loading: boolean;
  isOwner: boolean;
  can: (perm: Permission) => boolean;
  reloadSpace: () => Promise<void>;
  reloadMembers: () => Promise<void>;
  reloadLabels: () => Promise<void>;
  reloadFields: () => Promise<void>;
  reloadAccessProfiles: () => Promise<void>;
}

const Ctx = createContext<SpaceCtx | undefined>(undefined);

export function SpaceProvider({ spaceId, children }: { spaceId: string; children: ReactNode }) {
  const { user } = useAuth();
  const [space, setSpace] = useState<Space | null>(null);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [accessProfiles, setAccessProfiles] = useState<AccessProfile[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadSpace = useCallback(async () => setSpace(await api.spaces.get(spaceId)), [spaceId]);
  const reloadMembers = useCallback(async () => setMembers(await api.members.list(spaceId)), [spaceId]);
  const reloadLabels = useCallback(async () => setLabels(await api.labels.list(spaceId)), [spaceId]);
  const reloadFields = useCallback(
    async () => setFieldDefs(await api.fields.listDefs(spaceId)),
    [spaceId],
  );
  const reloadAccessProfiles = useCallback(
    async () => setAccessProfiles(await api.accessProfiles.list(spaceId)),
    [spaceId],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.spaces.get(spaceId),
      api.members.list(spaceId),
      api.accessProfiles.list(spaceId),
      api.labels.list(spaceId),
      api.fields.listDefs(spaceId),
    ])
      .then(([s, m, ap, l, f]) => {
        if (!active) return;
        setSpace(s);
        setMembers(m);
        setAccessProfiles(ap);
        setLabels(l);
        setFieldDefs(f);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [spaceId]);

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    members.forEach((m) => m.profile && map.set(m.user_id, m.profile));
    return map;
  }, [members]);

  const labelMap = useMemo(() => {
    const map = new Map<string, Label>();
    labels.forEach((l) => map.set(l.id, l));
    return map;
  }, [labels]);

  const isOwner = !!space && !!user && space.owner_id === user.id;

  const myPermissions = useMemo(() => {
    if (isOwner) return new Set<Permission>(['space.admin']);
    const me = members.find((m) => m.user_id === user?.id);
    return new Set<Permission>((me?.access_profile?.permissions ?? []) as Permission[]);
  }, [isOwner, members, user]);

  const can = useCallback(
    (perm: Permission) => isOwner || myPermissions.has('space.admin') || myPermissions.has(perm),
    [isOwner, myPermissions],
  );

  const value = useMemo<SpaceCtx>(
    () => ({
      space,
      members,
      accessProfiles,
      labels,
      fieldDefs,
      profileMap,
      labelMap,
      loading,
      isOwner,
      can,
      reloadSpace,
      reloadMembers,
      reloadLabels,
      reloadFields,
      reloadAccessProfiles,
    }),
    [
      space,
      members,
      accessProfiles,
      labels,
      fieldDefs,
      profileMap,
      labelMap,
      loading,
      isOwner,
      can,
      reloadSpace,
      reloadMembers,
      reloadLabels,
      reloadFields,
      reloadAccessProfiles,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpace(): SpaceCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSpace deve ser usado dentro de <SpaceProvider>');
  return ctx;
}
