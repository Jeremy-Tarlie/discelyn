-- Add STARTER between FREE and paid tiers (self-serve entry plan).
ALTER TYPE "PlanId" ADD VALUE 'STARTER' BEFORE 'OPS';
