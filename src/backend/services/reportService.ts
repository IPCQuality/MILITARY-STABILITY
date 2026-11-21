import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import type {
  ActivityStage,
  CategoryType,
  HandoverFormInput,
  HandoverReport,
  MilitaryStatus,
  ShiftType,
  StabilityPhase,
  StabilityStatus,
  UserProfile,
} from '../../shared/types/handover';
import { canSubmitReport, validateHandoverInput } from '../../domain/handover/handoverLogic';
import { db } from '../config/firebase';
import {
  formatCaughtError,
  handleFirestoreError,
  OperationType,
  toIsoString,
  WORKSPACE_ID,
} from './firebaseShared';

function mapDocToReport(id: string, data: DocumentData): HandoverReport {
  return {
    id,
    reportDate: String(data.reportDate ?? ''),
    shift: (data.shift as ShiftType) ?? 'Shift 1',
    category: (data.category as CategoryType) ?? 'OVERHAUL',
    machine: data.machine ? String(data.machine) : null,
    information: String(data.information ?? ''),
    followUp: String(data.followUp ?? ''),
    palletLocation: String(data.palletLocation ?? ''),
    isCompleted: Boolean(data.isCompleted),
    isRepairStart: typeof data.isRepairStart === 'boolean' ? data.isRepairStart : undefined,
    activityStage:
      typeof data.activityStage === 'string'
        ? (data.activityStage as ActivityStage)
        : undefined,
    militaryRound:
      typeof data.militaryRound === 'number' ? data.militaryRound : undefined,
    militaryStatus:
      typeof data.militaryStatus === 'string'
        ? (data.militaryStatus as MilitaryStatus)
        : undefined,
    militaryLeakBoxes:
      typeof data.militaryLeakBoxes === 'number' ? data.militaryLeakBoxes : undefined,
    stabilityPhase:
      typeof data.stabilityPhase === 'string'
        ? (data.stabilityPhase as StabilityPhase)
        : undefined,
    stabilityStatus:
      typeof data.stabilityStatus === 'string'
        ? (data.stabilityStatus as StabilityStatus)
        : undefined,
    leakLine:
      typeof data.leakLine === 'string' && data.leakLine.trim()
        ? data.leakLine.trim()
        : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? ''),
    updatedBy: data.updatedBy ? String(data.updatedBy) : null,
    updatedByName: data.updatedByName ? String(data.updatedByName) : null,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

function sortReportsNewestFirst(list: HandoverReport[]): HandoverReport[] {
  return [...list].sort((a, b) => {
    if (a.reportDate !== b.reportDate) {
      return b.reportDate.localeCompare(a.reportDate);
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function subscribeReportsFirebase(
  onData: (reports: HandoverReport[]) => void,
  onError: (message: string) => void
): () => void {
  const reportsPath = 'handover_reports';
  const q = query(
    collection(db, reportsPath),
    where('workspaceId', '==', WORKSPACE_ID)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const mapped = snapshot.docs.map((d) => mapDocToReport(d.id, d.data()));
      onData(sortReportsNewestFirst(mapped));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, reportsPath);
      } catch (thrown) {
        onError(formatCaughtError(thrown, 'Gagal memuat data handover dari Firestore.'));
      }
    }
  );
}

export async function loadReportsFirebase(): Promise<{
  reports: HandoverReport[];
  error?: string;
}> {
  const reportsPath = 'handover_reports';
  const q = query(
    collection(db, reportsPath),
    where('workspaceId', '==', WORKSPACE_ID)
  );

  try {
    const snapshot = await getDocs(q);
    const mapped = snapshot.docs.map((d) => mapDocToReport(d.id, d.data()));
    return { reports: sortReportsNewestFirst(mapped) };
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, reportsPath);
    } catch (thrown) {
      return {
        reports: [],
        error: formatCaughtError(thrown, 'Gagal memuat data laporan dari Firestore.'),
      };
    }
  }
}

export async function createReportFirebase(
  input: HandoverFormInput,
  user: UserProfile
): Promise<{ report?: HandoverReport; error?: string }> {
  const permission = canSubmitReport({
    user,
    input,
    editingReport: null,
  });
  if (!permission.allowed) {
    return { error: permission.reason || 'Anda tidak memiliki izin membuat laporan ini.' };
  }

  const validation = validateHandoverInput(input);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0] || 'Data laporan tidak valid.';
    return { error: firstErr };
  }

  const newDocRef = doc(collection(db, 'handover_reports'));
  const docPath = `handover_reports/${newDocRef.id}`;
  const actorName = (user.fullName || 'Pengawas').trim().slice(0, 120) || 'Pengawas';
  const sanitizedMachine = (validation.sanitizedMachine || '').trim().slice(0, 64);
  const isLeakStage =
    (input.activityStage === 'MILITARY' && input.militaryStatus === 'LEAK') ||
    (input.activityStage === 'STABILITY' && input.stabilityStatus === 'LEAK');
  const sanitizedLeakLine = isLeakStage ? (input.leakLine ?? '').trim().slice(0, 200) : '';

  const payload: DocumentData = {
    id: newDocRef.id,
    workspaceId: WORKSPACE_ID,
    reportDate: input.reportDate,
    shift: input.shift,
    category: input.category,
    machine: sanitizedMachine,
    information: input.information.trim().slice(0, 2000),
    followUp: input.followUp.trim().slice(0, 2000),
    palletLocation: (input.palletLocation ?? '').trim().slice(0, 200),
    isCompleted: Boolean(input.isCompleted),
    isRepairStart: Boolean(input.isRepairStart),
    ...(input.activityStage ? { activityStage: input.activityStage } : {}),
    ...(typeof input.militaryRound === 'number' ? { militaryRound: input.militaryRound } : {}),
    ...(input.militaryStatus ? { militaryStatus: input.militaryStatus } : {}),
    ...(typeof input.militaryLeakBoxes === 'number'
      ? { militaryLeakBoxes: input.militaryLeakBoxes }
      : {}),
    ...(input.stabilityPhase ? { stabilityPhase: input.stabilityPhase } : {}),
    ...(input.stabilityStatus ? { stabilityStatus: input.stabilityStatus } : {}),
    ...(sanitizedLeakLine ? { leakLine: sanitizedLeakLine } : {}),
    createdBy: user.id,
    createdByName: actorName,
    updatedBy: user.id,
    updatedByName: actorName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(newDocRef, payload);
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.CREATE, docPath);
    } catch (thrown) {
      return {
        error: formatCaughtError(thrown, 'Gagal menyimpan laporan ke Firestore.'),
      };
    }
  }

  const nowIso = new Date().toISOString();
  return {
    report: {
      id: newDocRef.id,
      reportDate: payload.reportDate,
      shift: payload.shift,
      category: payload.category,
      machine: payload.machine,
      information: payload.information,
      followUp: payload.followUp,
      palletLocation: payload.palletLocation,
      isCompleted: payload.isCompleted,
      isRepairStart: payload.isRepairStart,
      activityStage: input.activityStage,
      militaryRound: input.militaryRound,
      militaryStatus: input.militaryStatus,
      militaryLeakBoxes: input.militaryLeakBoxes,
      stabilityPhase: input.stabilityPhase,
      stabilityStatus: input.stabilityStatus,
      leakLine: sanitizedLeakLine || undefined,
      createdBy: payload.createdBy,
      createdByName: payload.createdByName,
      updatedBy: payload.updatedBy,
      updatedByName: payload.updatedByName,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

export async function updateReportFirebase(
  reportId: string,
  input: HandoverFormInput,
  user: UserProfile,
  existingReport?: HandoverReport
): Promise<{ report?: HandoverReport; error?: string }> {
  if (existingReport) {
    const permission = canSubmitReport({
      user,
      input,
      editingReport: existingReport,
    });
    if (!permission.allowed) {
      return { error: permission.reason || 'Anda tidak memiliki izin mengedit laporan ini.' };
    }
  }

  const validation = validateHandoverInput(input);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0] || 'Data laporan tidak valid.';
    return { error: firstErr };
  }

  const docPath = `handover_reports/${reportId}`;
  const reportRef = doc(db, 'handover_reports', reportId);
  const actorName = (user.fullName || 'Pengawas').trim().slice(0, 120) || 'Pengawas';
  const sanitizedMachine = (validation.sanitizedMachine || '').trim().slice(0, 64);
  const isLeakStage =
    (input.activityStage === 'MILITARY' && input.militaryStatus === 'LEAK') ||
    (input.activityStage === 'STABILITY' && input.stabilityStatus === 'LEAK');
  const sanitizedLeakLine = isLeakStage ? (input.leakLine ?? '').trim().slice(0, 200) : '';

  const updates: DocumentData = {
    reportDate: input.reportDate,
    shift: input.shift,
    category: input.category,
    machine: sanitizedMachine,
    information: input.information.trim().slice(0, 2000),
    issue: deleteField(),
    followUp: input.followUp.trim().slice(0, 2000),
    palletLocation: (input.palletLocation ?? '').trim().slice(0, 200),
    isCompleted: Boolean(input.isCompleted),
    isRepairStart: Boolean(input.isRepairStart),
    activityStage: input.activityStage ? input.activityStage : deleteField(),
    militaryRound:
      input.activityStage === 'MILITARY' && typeof input.militaryRound === 'number'
        ? input.militaryRound
        : deleteField(),
    militaryStatus:
      input.activityStage === 'MILITARY' && input.militaryStatus
        ? input.militaryStatus
        : deleteField(),
    militaryLeakBoxes:
      input.activityStage === 'MILITARY' &&
      input.militaryStatus === 'LEAK' &&
      typeof input.militaryLeakBoxes === 'number'
        ? input.militaryLeakBoxes
        : deleteField(),
    stabilityPhase:
      input.activityStage === 'STABILITY' && input.stabilityPhase
        ? input.stabilityPhase
        : deleteField(),
    stabilityStatus:
      input.activityStage === 'STABILITY' && input.stabilityStatus
        ? input.stabilityStatus
        : deleteField(),
    leakLine: sanitizedLeakLine ? sanitizedLeakLine : deleteField(),
    updatedBy: user.id,
    updatedByName: actorName,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(reportRef, updates);
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    } catch (thrown) {
      return {
        error: formatCaughtError(
          thrown,
          'Gagal memperbarui laporan. Pastikan Anda memiliki izin edit.'
        ),
      };
    }
  }

  return {
    report: {
      id: reportId,
      reportDate: updates.reportDate,
      shift: updates.shift,
      category: updates.category,
      machine: updates.machine,
      information: updates.information,
      followUp: updates.followUp,
      palletLocation: updates.palletLocation,
      isCompleted: updates.isCompleted,
      isRepairStart: updates.isRepairStart,
      activityStage: input.activityStage,
      militaryRound:
        input.activityStage === 'MILITARY' ? input.militaryRound : undefined,
      militaryStatus:
        input.activityStage === 'MILITARY' ? input.militaryStatus : undefined,
      militaryLeakBoxes:
        input.activityStage === 'MILITARY' && input.militaryStatus === 'LEAK'
          ? input.militaryLeakBoxes
          : undefined,
      stabilityPhase:
        input.activityStage === 'STABILITY' ? input.stabilityPhase : undefined,
      stabilityStatus:
        input.activityStage === 'STABILITY' ? input.stabilityStatus : undefined,
      leakLine: sanitizedLeakLine || undefined,
      createdBy: existingReport?.createdBy ?? user.id,
      createdByName: existingReport?.createdByName ?? actorName,
      updatedBy: updates.updatedBy,
      updatedByName: updates.updatedByName,
      createdAt: existingReport?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}
