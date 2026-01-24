"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Users,
  Plus,
  Trash2,
  Mail,
  User,
  Shield,
  ChevronRight,
  Info,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "manager" | "front_desk" | "maintenance" | "finance" | "marketing" | "readonly";
}

interface TeamSetupProps {
  members: TeamMember[];
  onChange: (members: TeamMember[]) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const ROLES = [
  { value: "manager", label: "Manager", description: "Full access to all features", icon: Shield },
  {
    value: "front_desk",
    label: "Front Desk",
    description: "Reservations and check-ins",
    icon: User,
  },
  {
    value: "maintenance",
    label: "Maintenance",
    description: "Site status and work orders",
    icon: User,
  },
  { value: "finance", label: "Finance", description: "Reports and payments", icon: User },
  {
    value: "marketing",
    label: "Marketing",
    description: "Promotions and communications",
    icon: User,
  },
  { value: "readonly", label: "View Only", description: "Read-only access", icon: User },
];

const roleValues: TeamMember["role"][] = [
  "manager",
  "front_desk",
  "maintenance",
  "finance",
  "marketing",
  "readonly",
];

const isTeamRole = (value: string): value is TeamMember["role"] =>
  roleValues.some((role) => role === value);

function generateId(): string {
  return `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function TeamMemberCard({
  member,
  onUpdate,
  onRemove,
}: {
  member: TeamMember;
  onUpdate: (member: TeamMember) => void;
  onRemove: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
      transition={SPRING_CONFIG}
      className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 space-y-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-medium">
              {member.firstName || member.lastName
                ? `${member.firstName} ${member.lastName}`.trim()
                : "New Team Member"}
            </p>
            <p className="text-sm text-slate-500">{member.email || "Enter email address"}</p>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-2 text-slate-500 hover:text-red-400 transition-colors"
          aria-label="Remove team member"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">First Name</Label>
          <Input
            value={member.firstName}
            onChange={(e) => onUpdate({ ...member, firstName: e.target.value })}
            placeholder="John"
            className="bg-slate-800/50 border-slate-600 text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Last Name</Label>
          <Input
            value={member.lastName}
            onChange={(e) => onUpdate({ ...member, lastName: e.target.value })}
            placeholder="Doe"
            className="bg-slate-800/50 border-slate-600 text-white"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-slate-400">Email Address</Label>
        <Input
          type="email"
          value={member.email}
          onChange={(e) => onUpdate({ ...member, email: e.target.value })}
          placeholder="hello@keeprstay.com"
          className="bg-slate-800/50 border-slate-600 text-white"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-slate-400">Role</Label>
        <Select
          value={member.role}
          onValueChange={(value) => {
            if (isTeamRole(value)) {
              onUpdate({ ...member, role: value });
            }
          }}
        >
          <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                <div className="flex flex-col">
                  <span>{role.label}</span>
                  <span className="text-xs text-slate-500">{role.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </motion.div>
  );
}

export function TeamSetup({
  members: initialMembers,
  onChange,
  onNext,
  onBack,
  onSkip,
}: TeamSetupProps) {
  const prefersReducedMotion = useReducedMotion();
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);

  const addMember = () => {
    const newMember: TeamMember = {
      id: generateId(),
      firstName: "",
      lastName: "",
      email: "",
      role: "front_desk",
    };
    const updated = [...members, newMember];
    setMembers(updated);
    onChange(updated);
  };

  const updateMember = (id: string, updated: TeamMember) => {
    const newMembers = members.map((m) => (m.id === id ? updated : m));
    setMembers(newMembers);
    onChange(newMembers);
  };

  const removeMember = (id: string) => {
    const newMembers = members.filter((m) => m.id !== id);
    setMembers(newMembers);
    onChange(newMembers);
  };

  const validMembers = members.filter((m) => m.email && m.email.includes("@"));

  const handleContinue = () => {
    onChange(members);
    onNext();
  };

  return (
    <div className="max-w-2xl">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 mb-4">
            <Users className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Invite Your Team</h2>
          <p className="text-slate-400">Add staff members who will help manage your campground</p>
        </motion.div>

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex gap-3"
        >
          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">How it works:</span> Each team member will
            receive an email invitation to set up their account. You can add more members later from
            your dashboard settings.
          </div>
        </motion.div>

        {/* Team Members List */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <AnimatePresence mode="popLayout">
            {members.length > 0 ? (
              members.map((member) => (
                <TeamMemberCard
                  key={member.id}
                  member={member}
                  onUpdate={(updated) => updateMember(member.id, updated)}
                  onRemove={() => removeMember(member.id)}
                />
              ))
            ) : (
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={prefersReducedMotion ? {} : { opacity: 1 }}
                className="text-center py-12 border-2 border-dashed border-slate-700 rounded-xl"
              >
                <UserPlus className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No team members yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Click below to add your first team member
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={addMember}
            className="w-full p-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Team Member
          </button>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 pt-4"
        >
          <Button
            onClick={handleContinue}
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
            )}
          >
            {validMembers.length > 0
              ? `Continue & Send ${validMembers.length} Invite${validMembers.length > 1 ? "s" : ""}`
              : "Continue Without Team"}
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={onBack}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Back
            </Button>
            <Button
              onClick={onSkip}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Skip for Now
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {validMembers.length > 0 && (
            <p className="text-center text-xs text-slate-500">
              Invites will be sent when you complete setup
            </p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
