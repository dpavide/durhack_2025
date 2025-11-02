import Button from "./ui/Button";
import Container from "./ui/Container";

export default function Hero() {
  return (
    <section className="pt-10 pb-12">
      <Container>
        <div className="max-w-4xl">
          <h1 className="text-[clamp(2.2rem,6vw,4.2rem)] font-extrabold leading-[1.05] tracking-tight"
              style={{color:"var(--brand-ink)"}}>
            Collaborative planning for your team
          </h1>
          <p className="mt-5 text-xl text-gray-500 max-w-3xl">
            Powered by real-time data. Coordinate schedules, manage meetings, and bring your team together effortlessly.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild href="/create">Create a MeetSpace</Button>
            <Button asChild href="/join" variant="outline">Join a MeetSpace</Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
