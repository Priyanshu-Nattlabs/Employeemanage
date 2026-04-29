type BuildInterviewXUrlInput = {
  prefillRole?: string;
  candidateName?: string;
  candidateEmail?: string;
};

function clean(v?: string) {
  return String(v || "").trim();
}

export function buildInterviewXAiInterviewUrl(input: BuildInterviewXUrlInput): string {
  // Force local InterviewX route for direct technical interview start.
  const base = "http://localhost:3300/students/interview-preparation/technical";

  const url = new URL(base);
  const role = clean(input.prefillRole);
  const candidateName = clean(input.candidateName);
  const candidateEmail = clean(input.candidateEmail);

  if (role) {
    url.searchParams.set("role", role);
    url.searchParams.set("targetRole", role);
  }
  if (candidateName) {
    url.searchParams.set("candidateName", candidateName);
    url.searchParams.set("name", candidateName);
  }
  if (candidateEmail) {
    url.searchParams.set("candidateEmail", candidateEmail);
    url.searchParams.set("email", candidateEmail);
  }

  // Force technical interview and skip pre-start form where supported.
  url.searchParams.set("interviewType", "technical");
  url.searchParams.set("mode", "technical");
  url.searchParams.set("autoStart", "1");
  url.searchParams.set("start", "1");
  url.searchParams.set("skipForm", "1");

  return url.toString();
}
