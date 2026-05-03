import { useEffect, useState } from 'react';
import {
  getCurrentInterventionKind,
  subscribeInterventionState,
} from '@/services/nudgeInterventionState';
import type { ClientInterventionKind } from '@/types/nudgeDelivery';

export function useInterventionState(): ClientInterventionKind {
  const [kind, setKind] = useState<ClientInterventionKind>(() => getCurrentInterventionKind());
  useEffect(() => subscribeInterventionState(() => setKind(getCurrentInterventionKind())), []);
  return kind;
}
