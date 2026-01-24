import { useState } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import {
  apiClient,
  CreatePublicWaitlistSchema,
  type CreatePublicWaitlistDto,
} from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface WaitlistDialogProps {
  campgroundId: string;
  siteId?: string;
  siteTypeId?: string;
  arrivalDate: string;
  departureDate: string;
  trigger?: React.ReactNode;
}

export function WaitlistDialog({
  campgroundId,
  siteId,
  siteTypeId,
  arrivalDate,
  departureDate,
  trigger,
}: WaitlistDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const waitlistFieldKeys: Array<keyof CreatePublicWaitlistDto> = [
    "campgroundId",
    "siteId",
    "siteClassId",
    "arrivalDate",
    "departureDate",
    "firstName",
    "lastName",
    "email",
    "phone",
  ];
  const waitlistFieldSet = new Set<string>(waitlistFieldKeys);
  const isWaitlistField = (field: string): field is keyof CreatePublicWaitlistDto =>
    waitlistFieldSet.has(field);

  const resolver: Resolver<CreatePublicWaitlistDto> = async (values) => {
    const result = CreatePublicWaitlistSchema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: FieldErrors<CreatePublicWaitlistDto> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && isWaitlistField(field)) {
        errors[field] = { type: issue.code, message: issue.message };
      }
    }

    return { values: {}, errors };
  };

  const form = useForm<CreatePublicWaitlistDto>({
    resolver,
    defaultValues: {
      campgroundId,
      siteId: siteId || undefined,
      siteClassId: siteTypeId || undefined,
      arrivalDate,
      departureDate,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    },
  });

  const onSubmit = async (data: CreatePublicWaitlistDto) => {
    try {
      await apiClient.createPublicWaitlistEntry(data);

      toast({
        title: "Joined Waitlist",
        description:
          "You have been added to the waitlist. We will notify you if a site becomes available.",
      });
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to join waitlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Join Waitlist</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join Waitlist</DialogTitle>
          <DialogDescription>
            Enter your contact details to be notified when a site becomes available.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" {...form.register("firstName", { required: true })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" {...form.register("lastName", { required: true })} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email", { required: true })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (Optional)</Label>
            <Input id="phone" type="tel" {...form.register("phone")} />
          </div>
          <DialogFooter>
            <Button type="submit">Join Waitlist</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
