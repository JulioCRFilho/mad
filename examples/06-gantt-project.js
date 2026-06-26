//@::gantt

//@Project1:Planning
const planningPhase = {
  duration: '2w',
  tasks: ['requirements', 'design']
};

//@Project1.1:Requirements
function gatherRequirements() {
  console.log('Gathering requirements...');
}

//@Project1.2:Design
function createDesign() {
  console.log('Creating system design...');
}

//@Project2:Development
const developmentPhase = {
  duration: '4w',
  tasks: ['backend', 'frontend']
};

//@Project2.1:Backend
function buildBackend() {
  console.log('Building backend API...');
}

//@Project3:Testing
const testingPhase = {
  duration: '2w',
  tasks: ['unit', 'integration']
};

//@Project3.1:Unit tests
function writeUnitTests() {
  console.log('Writing unit tests...');
}