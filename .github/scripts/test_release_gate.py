import importlib.util,unittest,os
spec=importlib.util.spec_from_file_location('gate',os.path.join(os.path.dirname(__file__),'release_gate.py'));g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
class T(unittest.TestCase):
    def test_unreadable_baseline_fails_closed(self):
        p=[];g.not_lower({"versionCode":5,"sha256":"a"},{"__no_baseline__":True},p);self.assertEqual(len(p),1)
    def test_lower_code_rejected(self):
        p=[];g.not_lower({"versionCode":4,"sha256":"a"},{"versionCode":5},p);self.assertEqual(len(p),1)
    def test_same_code_other_hash_rejected(self):
        p=[];g.not_lower({"versionCode":5,"sha256":"a"},{"versionCode":5,"sha256":"b"},p);self.assertEqual(len(p),1)
    def test_newer_ok(self):
        p=[];g.not_lower({"versionCode":6,"sha256":"a"},{"versionCode":5,"sha256":"b"},p);self.assertEqual(p,[])
    def test_live_failure_uses_committed_baseline(self):
        g.urllib.request.urlopen=lambda *a,**k:(_ for _ in ()).throw(OSError('offline'));g.committed_meta=lambda:{"versionCode":9}
        self.assertEqual(g.live_meta(),{"versionCode":9})
        g.committed_meta=lambda:None;self.assertTrue(g.live_meta().get("__no_baseline__"))
if __name__=='__main__':unittest.main()
