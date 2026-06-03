import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronsUpDown, Check, CircleDollarSign, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { name: "Afghanistan", flag: "🇦🇫" }, { name: "Albania", flag: "🇦🇱" },
  { name: "Algeria", flag: "🇩🇿" }, { name: "Andorra", flag: "🇦🇩" },
  { name: "Angola", flag: "🇦🇴" }, { name: "Antigua & Barbuda", flag: "🇦🇬" },
  { name: "Argentina", flag: "🇦🇷" }, { name: "Armenia", flag: "🇦🇲" },
  { name: "Australia", flag: "🇦🇺" }, { name: "Austria", flag: "🇦🇹" },
  { name: "Azerbaijan", flag: "🇦🇿" }, { name: "Bahamas", flag: "🇧🇸" },
  { name: "Bahrain", flag: "🇧🇭" }, { name: "Bangladesh", flag: "🇧🇩" },
  { name: "Barbados", flag: "🇧🇧" }, { name: "Belarus", flag: "🇧🇾" },
  { name: "Belgium", flag: "🇧🇪" }, { name: "Belize", flag: "🇧🇿" },
  { name: "Benin", flag: "🇧🇯" }, { name: "Bhutan", flag: "🇧🇹" },
  { name: "Bolivia", flag: "🇧🇴" }, { name: "Bosnia & Herzegovina", flag: "🇧🇦" },
  { name: "Botswana", flag: "🇧🇼" }, { name: "Brazil", flag: "🇧🇷" },
  { name: "Brunei", flag: "🇧🇳" }, { name: "Bulgaria", flag: "🇧🇬" },
  { name: "Burkina Faso", flag: "🇧🇫" }, { name: "Burundi", flag: "🇧🇮" },
  { name: "Cabo Verde", flag: "🇨🇻" }, { name: "Cambodia", flag: "🇰🇭" },
  { name: "Cameroon", flag: "🇨🇲" }, { name: "Canada", flag: "🇨🇦" },
  { name: "Central African Republic", flag: "🇨🇫" }, { name: "Chad", flag: "🇹🇩" },
  { name: "Chile", flag: "🇨🇱" }, { name: "China", flag: "🇨🇳" },
  { name: "Colombia", flag: "🇨🇴" }, { name: "Comoros", flag: "🇰🇲" },
  { name: "Congo (Brazzaville)", flag: "🇨🇬" }, { name: "Congo (Kinshasa)", flag: "🇨🇩" },
  { name: "Costa Rica", flag: "🇨🇷" }, { name: "Croatia", flag: "🇭🇷" },
  { name: "Cuba", flag: "🇨🇺" }, { name: "Cyprus", flag: "🇨🇾" },
  { name: "Czech Republic", flag: "🇨🇿" }, { name: "Denmark", flag: "🇩🇰" },
  { name: "Djibouti", flag: "🇩🇯" }, { name: "Dominican Republic", flag: "🇩🇴" },
  { name: "Ecuador", flag: "🇪🇨" }, { name: "Egypt", flag: "🇪🇬" },
  { name: "El Salvador", flag: "🇸🇻" }, { name: "Equatorial Guinea", flag: "🇬🇶" },
  { name: "Eritrea", flag: "🇪🇷" }, { name: "Estonia", flag: "🇪🇪" },
  { name: "Eswatini", flag: "🇸🇿" }, { name: "Ethiopia", flag: "🇪🇹" },
  { name: "Fiji", flag: "🇫🇯" }, { name: "Finland", flag: "🇫🇮" },
  { name: "France", flag: "🇫🇷" }, { name: "Gabon", flag: "🇬🇦" },
  { name: "Gambia", flag: "🇬🇲" }, { name: "Georgia", flag: "🇬🇪" },
  { name: "Germany", flag: "🇩🇪" }, { name: "Ghana", flag: "🇬🇭" },
  { name: "Greece", flag: "🇬🇷" }, { name: "Guatemala", flag: "🇬🇹" },
  { name: "Guinea", flag: "🇬🇳" }, { name: "Guinea-Bissau", flag: "🇬🇼" },
  { name: "Guyana", flag: "🇬🇾" }, { name: "Haiti", flag: "🇭🇹" },
  { name: "Honduras", flag: "🇭🇳" }, { name: "Hungary", flag: "🇭🇺" },
  { name: "Iceland", flag: "🇮🇸" }, { name: "India", flag: "🇮🇳" },
  { name: "Indonesia", flag: "🇮🇩" }, { name: "Iran", flag: "🇮🇷" },
  { name: "Iraq", flag: "🇮🇶" }, { name: "Ireland", flag: "🇮🇪" },
  { name: "Israel", flag: "🇮🇱" }, { name: "Italy", flag: "🇮🇹" },
  { name: "Ivory Coast", flag: "🇨🇮" }, { name: "Jamaica", flag: "🇯🇲" },
  { name: "Japan", flag: "🇯🇵" }, { name: "Jordan", flag: "🇯🇴" },
  { name: "Kazakhstan", flag: "🇰🇿" }, { name: "Kenya", flag: "🇰🇪" },
  { name: "Kuwait", flag: "🇰🇼" }, { name: "Kyrgyzstan", flag: "🇰🇬" },
  { name: "Laos", flag: "🇱🇦" }, { name: "Latvia", flag: "🇱🇻" },
  { name: "Lebanon", flag: "🇱🇧" }, { name: "Lesotho", flag: "🇱🇸" },
  { name: "Liberia", flag: "🇱🇷" }, { name: "Libya", flag: "🇱🇾" },
  { name: "Liechtenstein", flag: "🇱🇮" }, { name: "Lithuania", flag: "🇱🇹" },
  { name: "Luxembourg", flag: "🇱🇺" }, { name: "Madagascar", flag: "🇲🇬" },
  { name: "Malawi", flag: "🇲🇼" }, { name: "Malaysia", flag: "🇲🇾" },
  { name: "Maldives", flag: "🇲🇻" }, { name: "Mali", flag: "🇲🇱" },
  { name: "Malta", flag: "🇲🇹" }, { name: "Mauritania", flag: "🇲🇷" },
  { name: "Mauritius", flag: "🇲🇺" }, { name: "Mexico", flag: "🇲🇽" },
  { name: "Moldova", flag: "🇲🇩" }, { name: "Monaco", flag: "🇲🇨" },
  { name: "Mongolia", flag: "🇲🇳" }, { name: "Montenegro", flag: "🇲🇪" },
  { name: "Morocco", flag: "🇲🇦" }, { name: "Mozambique", flag: "🇲🇿" },
  { name: "Myanmar", flag: "🇲🇲" }, { name: "Namibia", flag: "🇳🇦" },
  { name: "Nepal", flag: "🇳🇵" }, { name: "Netherlands", flag: "🇳🇱" },
  { name: "New Zealand", flag: "🇳🇿" }, { name: "Nicaragua", flag: "🇳🇮" },
  { name: "Niger", flag: "🇳🇪" }, { name: "Nigeria", flag: "🇳🇬" },
  { name: "North Korea", flag: "🇰🇵" }, { name: "North Macedonia", flag: "🇲🇰" },
  { name: "Norway", flag: "🇳🇴" }, { name: "Oman", flag: "🇴🇲" },
  { name: "Pakistan", flag: "🇵🇰" }, { name: "Palestine", flag: "🇵🇸" },
  { name: "Panama", flag: "🇵🇦" }, { name: "Papua New Guinea", flag: "🇵🇬" },
  { name: "Paraguay", flag: "🇵🇾" }, { name: "Peru", flag: "🇵🇪" },
  { name: "Philippines", flag: "🇵🇭" }, { name: "Poland", flag: "🇵🇱" },
  { name: "Portugal", flag: "🇵🇹" }, { name: "Qatar", flag: "🇶🇦" },
  { name: "Romania", flag: "🇷🇴" }, { name: "Russia", flag: "🇷🇺" },
  { name: "Rwanda", flag: "🇷🇼" }, { name: "Saudi Arabia", flag: "🇸🇦" },
  { name: "Senegal", flag: "🇸🇳" }, { name: "Serbia", flag: "🇷🇸" },
  { name: "Sierra Leone", flag: "🇸🇱" }, { name: "Singapore", flag: "🇸🇬" },
  { name: "Slovakia", flag: "🇸🇰" }, { name: "Slovenia", flag: "🇸🇮" },
  { name: "Somalia", flag: "🇸🇴" }, { name: "South Africa", flag: "🇿🇦" },
  { name: "South Korea", flag: "🇰🇷" }, { name: "South Sudan", flag: "🇸🇸" },
  { name: "Spain", flag: "🇪🇸" }, { name: "Sri Lanka", flag: "🇱🇰" },
  { name: "Sudan", flag: "🇸🇩" }, { name: "Sweden", flag: "🇸🇪" },
  { name: "Switzerland", flag: "🇨🇭" }, { name: "Syria", flag: "🇸🇾" },
  { name: "Taiwan", flag: "🇹🇼" }, { name: "Tajikistan", flag: "🇹🇯" },
  { name: "Tanzania", flag: "🇹🇿" }, { name: "Thailand", flag: "🇹🇭" },
  { name: "Timor-Leste", flag: "🇹🇱" }, { name: "Togo", flag: "🇹🇬" },
  { name: "Trinidad & Tobago", flag: "🇹🇹" }, { name: "Tunisia", flag: "🇹🇳" },
  { name: "Turkey", flag: "🇹🇷" }, { name: "Turkmenistan", flag: "🇹🇲" },
  { name: "Uganda", flag: "🇺🇬" }, { name: "Ukraine", flag: "🇺🇦" },
  { name: "United Arab Emirates", flag: "🇦🇪" }, { name: "United Kingdom", flag: "🇬🇧" },
  { name: "United States", flag: "🇺🇸" }, { name: "Uruguay", flag: "🇺🇾" },
  { name: "Uzbekistan", flag: "🇺🇿" }, { name: "Venezuela", flag: "🇻🇪" },
  { name: "Vietnam", flag: "🇻🇳" }, { name: "Yemen", flag: "🇾🇪" },
  { name: "Zambia", flag: "🇿🇲" }, { name: "Zimbabwe", flag: "🇿🇼" },
];

const formSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  country: z.string().min(1, "Please select your country"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  referralCode: z.string().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", country: "", password: "", referralCode: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    registerMutation.mutate({ data: values } as any, {
      onSuccess: () => {
        toast({ title: "Account created!", description: "Please log in with your credentials." });
        setLocation("/auth/login");
      },
      onError: (error: any) => {
        toast({ title: "Registration failed", description: error?.data?.error ?? error.message ?? "An error occurred.", variant: "destructive" });
      },
    });
  }

  const selectedCountry = COUNTRIES.find(c => c.name === form.watch("country"));

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel – hidden on mobile */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 text-white"
        style={{ background: "linear-gradient(160deg,#0f2027 0%,#1a3a4a 50%,#0d4a2f 100%)" }}>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-400 flex items-center justify-center shadow">
            <CircleDollarSign className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">TaskEarn Pro</span>
        </div>

        <div className="space-y-8">
          <div>
            <p className="text-4xl font-extrabold leading-tight mb-3">Turn your spare<br />time into money 💵</p>
            <p className="text-white/60 text-sm leading-relaxed">
              Join hundreds of thousands of people globally earning real cash by completing simple tasks from anywhere.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Active Members", value: "284K+" },
              { label: "Paid Out", value: "$4.2M+" },
              { label: "Tasks Daily", value: "12,000+" },
              { label: "Countries", value: "180+" },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <p className="text-emerald-300 text-xl font-extrabold">{s.value}</p>
                <p className="text-white/50 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {["Complete surveys & video tasks", "Earn via M-Pesa, PayPal, Bank", "Level up for higher-paying tasks"].map(t => (
              <div key={t} className="flex items-center gap-2 text-sm text-white/70">
                <span className="text-emerald-400">✓</span> {t}
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs">© 2025 TaskEarn Pro. All rights reserved.</p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-5 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
              <CircleDollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">TaskEarn Pro</span>
          </div>

          <h2 className="text-2xl font-bold mb-1">Create your account</h2>
          <p className="text-muted-foreground text-sm mb-6">Free forever · No credit card needed</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Searchable Country picker */}
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Country</FormLabel>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <button
                          type="button"
                          role="combobox"
                          className={cn(
                            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {selectedCountry
                            ? <span>{selectedCountry.flag} {selectedCountry.name}</span>
                            : "Search your country…"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search country…" />
                        <CommandList className="max-h-52">
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandGroup>
                            {COUNTRIES.map(c => (
                              <CommandItem
                                key={c.name}
                                value={c.name}
                                onSelect={() => { field.onChange(c.name); setOpen(false); }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", field.value === c.name ? "opacity-100" : "opacity-0")} />
                                {c.flag} {c.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} placeholder="At least 6 characters" className="pr-10" {...field} />
                      <button type="button" tabIndex={-1}
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="referralCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Referral Code <span className="text-muted-foreground text-xs font-normal">(Optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. JOIN2025" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-11 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 mt-1" disabled={registerMutation.isPending}>
                {registerMutation.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</>
                  : "Create Free Account →"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground mt-5">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-semibold text-emerald-600 hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
