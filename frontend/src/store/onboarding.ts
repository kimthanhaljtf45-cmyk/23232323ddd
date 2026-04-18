import { create } from 'zustand';

export type OnboardingTarget = 'CHILD' | 'SELF';
export type OnboardingProgram = 'KIDS' | 'SPECIAL' | 'ADULT_SELF_DEFENSE' | 'ADULT_PRIVATE';

interface OnboardingState {
  target?: OnboardingTarget;
  program?: OnboardingProgram;
  name: string;
  phone: string;
  childAge?: string;
  goal?: string;

  setTarget: (target: OnboardingTarget) => void;
  setProgram: (program: OnboardingProgram) => void;
  setContact: (name: string, phone: string) => void;
  setChildAge: (age: string) => void;
  setGoal: (goal: string) => void;
  reset: () => void;

  // Computed role from target
  getRole: () => 'PARENT' | 'STUDENT';
}

const initialState = {
  target: undefined,
  program: undefined,
  name: '',
  phone: '',
  childAge: undefined,
  goal: undefined,
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialState,

  setTarget: (target) => set({ target }),
  setProgram: (program) => set({ program }),
  setContact: (name, phone) => set({ name, phone }),
  setChildAge: (childAge) => set({ childAge }),
  setGoal: (goal) => set({ goal }),
  reset: () => set(initialState),

  getRole: () => {
    const { target } = get();
    return target === 'CHILD' ? 'PARENT' : 'STUDENT';
  },
}));
