import unittest, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from data_pipeline import normalize, validate_rows, parse_source
class PipelineTest(unittest.TestCase):
 def test_normalize(self): self.assertEqual(normalize('  QUOTE  '),'quote')
 def test_duplicate_sense(self):
  row=['quote','price','v','견적을 제시하다','finance','3','quote a price;quoted amount','The firm will quote a price.','회사가 견적을 제시할 것이다.']
  with self.assertRaises(ValueError): validate_rows([row,row])
 def test_missing_translation(self):
  with self.assertRaises(ValueError):validate_rows([['quote','price','v','견적을 제시하다','finance','3','quote a price','The firm will quote a price.','']])
 def test_source_counts(self):
  self.assertEqual(len(parse_source('ngsl')),2809)
  self.assertEqual(len(parse_source('tsl')),1250)
  self.assertGreater(len(parse_source('bsl')),1600)
if __name__=='__main__':unittest.main()
