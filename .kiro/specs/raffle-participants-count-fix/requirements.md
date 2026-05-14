# Requirements Document

## Introduction

This bugfix addresses a critical data inconsistency in the raffle participants endpoint. The `/api/raffles/117/participants` endpoint returns an incorrect participant count (36) while the main `/api/raffles` endpoint correctly reports 234 unique participants for the same raffle. This discrepancy undermines data integrity and user trust in the raffle system.

## Glossary

- **Participants_Endpoint**: The API endpoint `/api/raffles/[raffleId]/participants` that returns detailed participant information for a specific raffle
- **Main_Raffles_Endpoint**: The API endpoint `/api/raffles` that returns a list of raffles with summary statistics including participant counts
- **Unique_Participant**: A distinct wallet address that has one or more entries in a raffle
- **Raffle_Entry**: A record in the `shellies_raffle_entries` table representing tickets purchased by a wallet for a specific raffle
- **Participant_Count_Function**: The database function `get_raffle_participant_counts` that calculates unique participant counts
- **RLS_Policy**: Row Level Security policy in the database that controls data access based on user authentication

## Requirements

### Requirement 1: Correct Participant Count

**User Story:** As a raffle administrator, I want the participants endpoint to return the correct total count of unique participants, so that I can accurately track raffle engagement.

#### Acceptance Criteria

1. WHEN the Participants_Endpoint is queried for a raffle, THE System SHALL return a total count equal to the number of distinct wallet addresses with entries for that raffle
2. WHEN the Participants_Endpoint is queried for raffle 117, THE System SHALL return a total of 234 matching the Main_Raffles_Endpoint
3. FOR ALL raffles, THE participant count from Participants_Endpoint SHALL match the current_participants value from Main_Raffles_Endpoint

### Requirement 2: Data Consistency Verification

**User Story:** As a developer, I want to verify that no database queries or policies are filtering out valid entries, so that all participant data is accurately represented.

#### Acceptance Criteria

1. WHEN querying the shellies_raffle_entries table, THE System SHALL include all entries regardless of RLS_Policy restrictions when using admin client
2. WHEN aggregating participants by wallet address, THE System SHALL count each distinct wallet address exactly once
3. IF multiple Raffle_Entry records exist for the same wallet address, THEN THE System SHALL group them as a single Unique_Participant

### Requirement 3: Root Cause Identification

**User Story:** As a developer, I want to identify the specific cause of the count discrepancy, so that I can implement a targeted fix.

#### Acceptance Criteria

1. THE investigation SHALL verify whether database query logic correctly filters entries by raffle_id
2. THE investigation SHALL verify whether caching mechanisms are serving stale data
3. THE investigation SHALL verify whether RLS_Policy settings affect query results
4. THE investigation SHALL verify whether the Participant_Count_Function is being called correctly
5. WHEN the root cause is identified, THE System SHALL document the specific code or configuration causing the discrepancy

### Requirement 4: Endpoint Consistency

**User Story:** As an API consumer, I want both raffle endpoints to use the same participant counting logic, so that I receive consistent data across the API.

#### Acceptance Criteria

1. WHEN both endpoints calculate participant counts, THE System SHALL use identical logic for counting distinct wallet addresses
2. WHEN the Main_Raffles_Endpoint uses the Participant_Count_Function, THE Participants_Endpoint SHALL use equivalent counting logic
3. IF the counting logic is updated, THEN THE System SHALL apply the update to both endpoints simultaneously
