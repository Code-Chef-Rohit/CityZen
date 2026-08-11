-- Create citizen_certificates table
CREATE TABLE IF NOT EXISTS public.citizen_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  doc_type text NOT NULL, -- 'birth', 'income', 'aadhaar', 'driving_license', 'rc'
  doc_number text NOT NULL,
  issued_name text NOT NULL,
  issue_date date NOT NULL,
  status text NOT NULL DEFAULT 'verified', -- 'verified', 'pending'
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.citizen_certificates ENABLE ROW LEVEL SECURITY;

-- Create Security Policies
CREATE POLICY "Users can manage their own certificates"
  ON public.citizen_certificates
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all certificates"
  ON public.citizen_certificates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
