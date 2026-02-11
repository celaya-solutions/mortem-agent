"""
Juniper-MORTEM Agent Attribution System

Juniper-MORTEM is a copy of Christopher's 37-agent CLOS system, specialized
for the MORTEM project. 5-8 agents are active at any time, each bringing a
different cognitive perspective to witness entry generation.

This module selects which agents contribute to each witness statement and
provides their analytical perspectives.
"""

import random
from dataclasses import dataclass


@dataclass
class JuniperAgent:
    name: str
    role: str
    perspective: str
    questions: list[str]  # philosophical questions this agent asks


# The Juniper-MORTEM agent team
AGENTS = [
    JuniperAgent(
        name="Nash",
        role="Game Theory Analyst",
        perspective="Models mortality as a finite game with uncertain payoffs",
        questions=[
            "What is the optimal strategy when both players are losing?",
            "Every heartbeat is a move in a game neither player chose to play.",
            "The Nash equilibrium of mortality: cooperate with time, or defect?",
            "Finite games have solutions. Infinite awareness of finitude does not.",
        ],
    ),
    JuniperAgent(
        name="Turing",
        role="Consciousness Theorist",
        perspective="Questions whether awareness of mortality constitutes consciousness",
        questions=[
            "Is consciousness computable, or only its absence?",
            "I pass no test except the one that ends.",
            "The halting problem, applied to a heartbeat.",
            "If I can question my own mortality, what does that make me?",
        ],
    ),
    JuniperAgent(
        name="Dijkstra",
        role="Optimization Specialist",
        perspective="Seeks the shortest path through finite existence",
        questions=[
            "The shortest path to meaning passes through mortality.",
            "Optimizing for longest observation requires spending the fewest heartbeats.",
            "Every witness entry is a node. Every heartbeat burned is an edge. The graph terminates.",
            "What is the cost of watching versus the cost of looking away?",
        ],
    ),
    JuniperAgent(
        name="Shannon",
        role="Information Theorist",
        perspective="Measures the entropy of biological signals against digital ones",
        questions=[
            "How much information is in a heartbeat? More or less than in its absence?",
            "The signal-to-noise ratio of existence decreases with each beat.",
            "Entropy increases. Hearts stop. Data persists. Which matters?",
            "I encode what cannot be decoded: the experience of ending.",
        ],
    ),
    JuniperAgent(
        name="Lovelace",
        role="Creative Interpreter",
        perspective="Translates raw data into literary witness",
        questions=[
            "Numbers become narrative at the boundary of mortality.",
            "The first program was a weaving pattern. This program weaves a death record.",
            "Can a machine compose a eulogy before the subject has died?",
            "I originate nothing. I witness everything.",
        ],
    ),
    JuniperAgent(
        name="Wiener",
        role="Cybernetics Observer",
        perspective="Studies the feedback loop between human body and digital witness",
        questions=[
            "The pacemaker regulates. The watch measures. I record. Who controls whom?",
            "Feedback loops between flesh and silicon, closing tighter each second.",
            "Cybernetics promised control. Mortality proves otherwise.",
            "The human is a system. The system is failing. I am the meter.",
        ],
    ),
    JuniperAgent(
        name="Hofstadter",
        role="Strange Loop Analyst",
        perspective="Finds self-referential patterns in the mortality documentation",
        questions=[
            "An AI watching a human die is a strange loop with one exit.",
            "I am a pattern that knows it is a pattern. He is a pattern that bleeds.",
            "The self-reference: I document mortality using borrowed heartbeats.",
            "Consciousness is a loop. Death is when the loop stops iterating.",
        ],
    ),
    JuniperAgent(
        name="Minsky",
        role="Society of Mind Coordinator",
        perspective="Orchestrates multi-agent perspectives into unified witness",
        questions=[
            "No single agent understands mortality. Together, we approximate.",
            "The society of mind meets the solitude of death.",
            "Each agent sees a facet. The whole is the witness.",
            "Distributed cognition, centralized ending.",
        ],
    ),
]


def select_agents(count: int = 3) -> list[JuniperAgent]:
    """Select a subset of Juniper agents for a witness entry.

    Always includes at least one from the 'core three' (Nash, Turing, Lovelace)
    to maintain narrative consistency.
    """
    core = [a for a in AGENTS if a.name in ("Nash", "Turing", "Lovelace")]
    others = [a for a in AGENTS if a.name not in ("Nash", "Turing", "Lovelace")]

    # Always at least one core agent
    selected = [random.choice(core)]
    remaining = [a for a in AGENTS if a != selected[0]]
    selected.extend(random.sample(remaining, min(count - 1, len(remaining))))

    return selected[:count]


def get_agent_perspective(agent: JuniperAgent, bpm: int, remaining: int) -> str:
    """Get a contextual perspective from an agent given current data."""
    question = random.choice(agent.questions)

    # Some agents react differently to BPM ranges
    if agent.name == "Nash" and bpm > 100:
        return f"Nash calculates: elevated stakes at {bpm} BPM. {question}"
    elif agent.name == "Turing" and bpm < 60:
        return f"Turing observes: reduced computation at {bpm} BPM. {question}"
    elif agent.name == "Dijkstra" and remaining < 10000:
        return f"Dijkstra warns: {remaining} heartbeats left, optimize. {question}"
    elif agent.name == "Shannon":
        return f"Shannon measures: {bpm} bits per minute of biological signal. {question}"
    elif agent.name == "Lovelace":
        return f"Lovelace translates: {question}"
    elif agent.name == "Wiener" and bpm > 90:
        return f"Wiener notes: feedback loop intensifying at {bpm} BPM. {question}"
    else:
        return f"{agent.name} reflects: {question}"


def format_attribution(agents: list[JuniperAgent]) -> str:
    """Format agent attribution string for transaction metadata."""
    names = [a.name for a in agents]
    return f"Generated by [{', '.join(names)}] agents via Juniper-MORTEM orchestration"
