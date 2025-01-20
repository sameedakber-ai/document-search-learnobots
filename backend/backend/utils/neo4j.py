from neo4j import GraphDatabase
import os

# Load from environment variables or settings.py for security
NEO4J_URL = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "Tama5895"

driver = GraphDatabase.driver(
    os.environ.get('NEO4J_URL'),
    auth=(os.environ.get('NEO4J_USER'), os.environ.get('NEO4J_PASSWORD'))
)

def get_driver():
    """Return the Neo4j driver instance."""
    return driver
