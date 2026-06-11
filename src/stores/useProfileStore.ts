import { create } from "zustand";
import { getProfile, type ProfileView } from "@/services/gamification";

interface ProfileStore {
  profile: ProfileView | null;
  load: () => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: null,
  load: async () => {
    const profile = await getProfile();
    set({ profile });
  },
}));
