/**
 * Proposal Email Template
 * Phase 46-47: Proposal System
 *
 * React Email template for sending proposals to prospects.
 */
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface ProposalEmailProps {
  recipientName: string;
  companyName: string;
  proposalUrl: string;
  expiresAt: string;
  agencyName: string;
}

export function ProposalEmail({
  recipientName,
  companyName,
  proposalUrl,
  expiresAt,
  agencyName,
}: ProposalEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>SEO pasiulymas: {companyName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Sveiki, {recipientName}!</Heading>
          <Text style={text}>
            Parengeme SEO pasiulyma jusu imonei <strong>{companyName}</strong>.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={proposalUrl}>
              Perziureti pasiulyma
            </Button>
          </Section>
          <Text style={text}>
            Pasiulymas galioja iki {expiresAt}.
          </Text>
          <Text style={footer}>
            Pagarbiai,<br />
            {agencyName} komanda
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "Geist, sans-serif" };
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "40px 20px", borderRadius: "8px" };
const h1 = { color: "#14141a", fontSize: "24px", fontWeight: "600", margin: "0 0 20px" };
const text = { color: "#54545a", fontSize: "16px", lineHeight: "24px", margin: "0 0 16px" };
const buttonContainer = { textAlign: "center" as const, margin: "32px 0" };
const button = { backgroundColor: "#0f4f3d", borderRadius: "6px", color: "#fff", fontSize: "16px", fontWeight: "600", padding: "12px 24px", textDecoration: "none" };
const footer = { color: "#93939a", fontSize: "14px", marginTop: "32px" };
